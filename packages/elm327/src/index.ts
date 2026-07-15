import { CommandScheduler, type CommandResult, type DiscoveredAdapter, type ObdTransport, type ScheduledCommand, type TransportStatus } from '@prius/obd-core';

export type ElmState =
  | 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'TRANSPORT_CONNECTED'
  | 'INITIALIZING_ADAPTER' | 'DETECTING_PROTOCOL' | 'IDENTIFYING_VEHICLE'
  | 'READY' | 'RECONNECTING' | 'ERROR';

export type ElmStatusMessage =
  | 'OK' | 'NO DATA' | '?' | 'UNABLE TO CONNECT' | 'BUS INIT'
  | 'CAN ERROR' | 'STOPPED' | 'BUFFER FULL';

export interface ParsedElmResponse {
  raw: string;
  lines: string[];
  dataLines: string[];
  statuses: ElmStatusMessage[];
  complete: boolean;
}

const statuses: ElmStatusMessage[] = ['UNABLE TO CONNECT', 'BUFFER FULL', 'CAN ERROR', 'NO DATA', 'BUS INIT', 'STOPPED', 'OK', '?'];

export const parseElmResponse = (raw: string, command?: string): ParsedElmResponse => {
  const complete = raw.includes('>');
  const normalizedCommand = command?.replace(/\s/g, '').toUpperCase();
  const lines = raw.replace(/\0/g, '').replace(/>/g, '').split(/\r\n|\r|\n/)
    .map((line) => line.trim()).filter(Boolean)
    .filter((line) => line.replace(/\s/g, '').toUpperCase() !== normalizedCommand);
  const found = lines.flatMap((line) => statuses.filter((status) => line.toUpperCase().includes(status)));
  const dataLines = lines.filter((line) => !statuses.some((status) => line.toUpperCase().includes(status)))
    .map((line) => line.replace(/\s/g, '').toUpperCase())
    .filter((line) => /^[0-9A-F]+$/.test(line) && (line.length % 2 === 0 || (line.length > 3 && (line.length - 3) % 2 === 0)));
  return { raw, lines, dataLines, statuses: [...new Set(found)], complete };
};

export class PromptAssembler {
  private buffer = '';
  push(chunk: Uint8Array): string[] {
    this.buffer += new TextDecoder().decode(chunk);
    const messages: string[] = [];
    while (this.buffer.includes('>')) {
      const index = this.buffer.indexOf('>');
      messages.push(this.buffer.slice(0, index + 1));
      this.buffer = this.buffer.slice(index + 1);
    }
    return messages;
  }
  reset(): void { this.buffer = ''; }
}

export interface ElmClientOptions {
  commandTimeoutMs?: number;
  initializationSequence?: string[];
  onRawLog?: (direction: 'IN' | 'OUT', value: string) => void;
}

const defaultInit = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH1', 'ATAT1', 'ATSP0', 'ATI', 'ATDP', 'ATDPN', 'ATRV'];

export class Elm327Client {
  private state: ElmState = 'DISCONNECTED';
  private assembler = new PromptAssembler();
  private pending: { command: string; startedAt: number; resolve: (value: CommandResult) => void; reject: (reason: Error) => void } | undefined;
  private unsubscribe: (() => void) | undefined;
  readonly scheduler: CommandScheduler;

  constructor(readonly transport: ObdTransport, private readonly options: ElmClientOptions = {}) {
    this.scheduler = new CommandScheduler((command) => this.execute(command));
  }

  getState(): ElmState { return this.state; }

  async scan(): Promise<DiscoveredAdapter[]> {
    this.state = 'SCANNING';
    try { return await this.transport.scan(); }
    finally { if (this.state === 'SCANNING') this.state = 'DISCONNECTED'; }
  }

  async connect(adapter: DiscoveredAdapter): Promise<void> {
    if (this.state !== 'DISCONNECTED' && this.state !== 'ERROR' && this.state !== 'RECONNECTING') return;
    this.state = 'CONNECTING';
    await this.transport.connect(adapter);
    this.state = 'TRANSPORT_CONNECTED';
    this.unsubscribe = this.transport.subscribe((chunk) => this.onData(chunk));
    this.state = 'INITIALIZING_ADAPTER';
    for (const command of this.options.initializationSequence ?? defaultInit) {
      try { await this.scheduler.enqueue({ id: `init-${command}`, command, priority: 'SAFETY_READ', timeoutMs: this.options.commandTimeoutMs ?? 2500 }); }
      catch { /* clones may not support every AT command */ }
    }
    this.state = 'DETECTING_PROTOCOL';
    await this.scheduler.enqueue({ id: 'protocol', command: 'ATDP', priority: 'SAFETY_READ', timeoutMs: this.options.commandTimeoutMs ?? 2500 });
    this.state = 'IDENTIFYING_VEHICLE';
    this.state = 'READY';
  }

  async disconnect(): Promise<void> {
    this.scheduler.cancelPending('Disconnected');
    this.pending?.reject(new Error('Disconnected'));
    this.pending = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.assembler.reset();
    await this.transport.disconnect();
    this.state = 'DISCONNECTED';
  }

  private execute(command: ScheduledCommand): Promise<CommandResult> {
    if (this.pending) return Promise.reject(new Error('Command overlap prevented'));
    return new Promise((resolve, reject) => {
      this.pending = { command: command.command, startedAt: Date.now(), resolve, reject };
      const wire = `${command.command.replace(/[\r\n]/g, '')}\r`;
      this.options.onRawLog?.('OUT', wire);
      void this.transport.write(new TextEncoder().encode(wire)).catch((error: unknown) => {
        this.pending = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  private onData(chunk: Uint8Array): void {
    for (const raw of this.assembler.push(chunk)) {
      this.options.onRawLog?.('IN', raw);
      const pending = this.pending;
      if (!pending) continue;
      this.pending = undefined;
      pending.resolve({ raw, latencyMs: Date.now() - pending.startedAt });
    }
  }
}

export class SimulatorTransport implements ObdTransport {
  readonly type = 'SIMULATOR' as const;
  private status: TransportStatus = 'DISCONNECTED';
  private listeners = new Set<(data: Uint8Array) => void>();
  private scenario: 'CITY' | 'HIGHWAY' | 'SLOW' | 'DTC' = 'CITY';
  private tick = 0;

  setScenario(value: typeof this.scenario): void { this.scenario = value; }
  async scan(): Promise<DiscoveredAdapter[]> { this.status = 'SCANNING'; this.status = 'DISCONNECTED'; return [{ id: 'simulator', name: 'Prius C Simulator', signalStrength: -25 }]; }
  async connect(): Promise<void> { this.status = 'CONNECTED'; }
  async disconnect(): Promise<void> { this.status = 'DISCONNECTED'; }
  subscribe(listener: (data: Uint8Array) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getStatus(): TransportStatus { return this.status; }

  async write(data: Uint8Array): Promise<void> {
    if (this.status !== 'CONNECTED') throw new Error('Simulator disconnected');
    const command = new TextDecoder().decode(data).trim().toUpperCase();
    const response = this.responseFor(command);
    const delay = this.scenario === 'SLOW' ? 900 : 35;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const wire = `${command}\r${response}\r>`;
    const split = Math.max(1, Math.floor(wire.length / 2));
    for (const chunk of [wire.slice(0, split), wire.slice(split)]) {
      const bytes = new TextEncoder().encode(chunk);
      for (const listener of this.listeners) listener(bytes);
    }
  }

  private responseFor(command: string): string {
    this.tick += 1;
    if (command === 'ATI') return 'ELM327 SIM v1.0';
    if (command === 'ATDP') return 'ISO 15765-4 (CAN 11/500)';
    if (command === 'ATDPN') return 'A6';
    if (command === 'ATRV') return `${(13.8 + Math.sin(this.tick / 10) * 0.2).toFixed(1)}V`;
    if (command.startsWith('AT')) return 'OK';
    if (command === '0100') return '7E8 06 41 00 BE 3E B8 13';
    if (command === '0120') return '7E8 06 41 20 80 01 A0 01';
    if (command === '010D') { const speed = this.scenario === 'HIGHWAY' ? 96 : Math.max(0, Math.round(36 + Math.sin(this.tick / 4) * 30)); return `7E8 03 41 0D ${speed.toString(16).padStart(2, '0')}`; }
    if (command === '010C') { const rpm = Math.round((1200 + Math.sin(this.tick / 3) * 700) * 4); return `7E8 04 41 0C ${(rpm >> 8).toString(16).padStart(2, '0')} ${(rpm & 255).toString(16).padStart(2, '0')}`; }
    if (command === '0105') return '7E8 03 41 05 79';
    if (command === '0110') return '7E8 04 41 10 01 F4';
    if (command === '0142') return '7E8 04 41 42 36 B0';
    if (command === '015E') return '7E8 04 41 5E 00 64';
    if (command === '03') return this.scenario === 'DTC' ? '7E8 04 43 01 33 00' : '7E8 02 43 00';
    return 'NO DATA';
  }
}
