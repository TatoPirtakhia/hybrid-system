import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { NativeModule, requireNativeModule } from 'expo';
import type { DiscoveredAdapter, ObdTransport, TransportStatus } from '@prius/obd-core';
import { bytesToHex } from '@prius/shared';

export interface BleGattConfiguration { serviceUuid?: string; writeCharacteristicUuid?: string; notifyCharacteristicUuid?: string }

export class BleTransport implements ObdTransport {
  readonly type = 'BLE' as const;
  private manager = new BleManager(); private status: TransportStatus = 'DISCONNECTED'; private device: Device | undefined; private monitor: Subscription | undefined;
  private listeners = new Set<(value: Uint8Array) => void>(); private configuration: BleGattConfiguration = {};
  constructor(configuration?: BleGattConfiguration) { if (configuration) this.configuration = configuration; }
  async scan(): Promise<DiscoveredAdapter[]> {
    this.status = 'SCANNING';
    return new Promise((resolve, reject) => {
      const found = new Map<string, DiscoveredAdapter>();
      const timer = setTimeout(() => { this.manager.stopDeviceScan(); this.status = 'DISCONNECTED'; resolve([...found.values()]); }, 5000);
      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) { clearTimeout(timer); this.manager.stopDeviceScan(); this.status = 'ERROR'; reject(error); return; }
        if (device?.name || device?.localName) found.set(device.id, { id: device.id, name: device.name ?? device.localName ?? 'BLE adapter', ...(device.rssi !== null ? { signalStrength: device.rssi } : {}) });
      });
    });
  }
  async connect(adapter: DiscoveredAdapter): Promise<void> {
    if (this.device?.id === adapter.id && this.status === 'CONNECTED') return;
    this.status = 'CONNECTING'; this.device = await this.manager.connectToDevice(adapter.id); await this.device.discoverAllServicesAndCharacteristics();
    const services = await this.device.services();
    const candidates: Array<{ service: string; characteristic: string; notify: boolean; write: boolean }> = [];
    for (const service of services) for (const c of await service.characteristics()) candidates.push({ service: service.uuid, characteristic: c.uuid, notify: c.isNotifiable, write: c.isWritableWithResponse || c.isWritableWithoutResponse });
    const write = candidates.find((c) => c.write && (!this.configuration.serviceUuid || c.service === this.configuration.serviceUuid) && (!this.configuration.writeCharacteristicUuid || c.characteristic === this.configuration.writeCharacteristicUuid));
    const notify = candidates.find((c) => c.notify && (!this.configuration.serviceUuid || c.service === this.configuration.serviceUuid) && (!this.configuration.notifyCharacteristicUuid || c.characteristic === this.configuration.notifyCharacteristicUuid));
    if (!write || !notify) { this.status = 'ERROR'; throw new Error('No compatible BLE write/notify characteristic. Configure GATT UUIDs manually.'); }
    this.configuration = { serviceUuid: write.service, writeCharacteristicUuid: write.characteristic, notifyCharacteristicUuid: notify.characteristic };
    this.monitor = this.device.monitorCharacteristicForService(notify.service, notify.characteristic, (error, value) => { if (error) { this.status = 'ERROR'; return; } if (value?.value) { const bytes = Uint8Array.from(Buffer.from(value.value, 'base64')); for (const listener of this.listeners) listener(bytes); } });
    this.status = 'CONNECTED';
  }
  async disconnect(): Promise<void> { this.monitor?.remove(); if (this.device) await this.manager.cancelDeviceConnection(this.device.id).catch(() => undefined); this.device = undefined; this.status = 'DISCONNECTED'; }
  async write(data: Uint8Array): Promise<void> { if (!this.device || !this.configuration.serviceUuid || !this.configuration.writeCharacteristicUuid) throw new Error('BLE not connected'); await this.device.writeCharacteristicWithResponseForService(this.configuration.serviceUuid, this.configuration.writeCharacteristicUuid, Buffer.from(data).toString('base64')); }
  subscribe(listener: (data: Uint8Array) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getStatus(): TransportStatus { return this.status; }
  getConfiguration(): BleGattConfiguration { return { ...this.configuration }; }
}

export class WifiTransport implements ObdTransport {
  readonly type = 'WIFI' as const; private status: TransportStatus = 'DISCONNECTED'; private socket: ReturnType<typeof TcpSocket.createConnection> | undefined; private listeners = new Set<(data: Uint8Array) => void>();
  constructor(private readonly host = '192.168.0.10', private readonly port = 35000, private readonly timeoutMs = 5000) {}
  async scan(): Promise<DiscoveredAdapter[]> { return [{ id: `${this.host}:${this.port}`, name: `Wi-Fi ELM327 (${this.host}:${this.port})` }]; }
  async connect(): Promise<void> { this.status = 'CONNECTING'; await new Promise<void>((resolve, reject) => { const socket = TcpSocket.createConnection({ host: this.host, port: this.port }, () => { this.socket = socket; this.status = 'CONNECTED'; resolve(); }); const timer = setTimeout(() => { socket.destroy(); reject(new Error('Wi-Fi connection timed out')); }, this.timeoutMs); socket.on('connect', () => clearTimeout(timer)); socket.on('data', (data) => { const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data; for (const listener of this.listeners) listener(Uint8Array.from(bytes)); }); socket.on('error', (error) => { clearTimeout(timer); this.status = 'ERROR'; reject(error); }); socket.on('close', () => { this.status = 'DISCONNECTED'; }); }); }
  async disconnect(): Promise<void> { this.socket?.destroy(); this.socket = undefined; this.status = 'DISCONNECTED'; }
  async write(data: Uint8Array): Promise<void> { if (!this.socket) throw new Error('Wi-Fi adapter not connected'); await new Promise<void>((resolve, reject) => this.socket!.write(data, undefined, (error?: Error) => error ? reject(error) : resolve())); }
  subscribe(listener: (data: Uint8Array) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getStatus(): TransportStatus { return this.status; }
}

type ClassicEvents = { onData(event: { hex: string }): void; onDisconnected(event: { reason: string }): void };
declare class AndroidClassicSppNative extends NativeModule<ClassicEvents> { scan(): Promise<Array<{ id: string; name: string }>>; connect(id: string): Promise<void>; disconnect(): Promise<void>; write(hex: string): Promise<void>; getStatus(): string }

export class AndroidClassicTransport implements ObdTransport {
  readonly type = 'ANDROID_CLASSIC' as const; private native = requireNativeModule<AndroidClassicSppNative>('AndroidClassicSpp'); private listeners = new Set<(data: Uint8Array) => void>(); private subscription?: { remove(): void };
  async scan(): Promise<DiscoveredAdapter[]> { return this.native.scan(); }
  async connect(adapter: DiscoveredAdapter): Promise<void> { await this.native.connect(adapter.id); this.subscription = this.native.addListener('onData', ({ hex }) => { const bytes = Uint8Array.from(hex.match(/.{2}/g)?.map((x) => Number.parseInt(x, 16)) ?? []); for (const listener of this.listeners) listener(bytes); }); }
  async disconnect(): Promise<void> { this.subscription?.remove(); await this.native.disconnect(); }
  async write(data: Uint8Array): Promise<void> { await this.native.write(bytesToHex(data)); }
  subscribe(listener: (data: Uint8Array) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getStatus(): TransportStatus { return this.native.getStatus() as TransportStatus; }
}
