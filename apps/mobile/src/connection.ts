import { AppState } from 'react-native';
import { PriusCControls } from './prius-c-controls';
import { Elm327Client, SimulatorTransport, parseElmResponse } from '@prius/elm327';
import { standardPids, decodeStandardPid, parseSupportedPidBitmap, type ExecutableTelemetryDefinition } from '@prius/vehicle-profiles';
import { assembleIsoTp, type DiscoveredAdapter, type ObdTransport } from '@prius/obd-core';
import type { TelemetrySample } from '@prius/shared';
import { TripAggregator, parseMode03Dtcs } from '@prius/telemetry';
import { appendTripSampleBatch, saveDiagnosticScan, upsertTrip, logVehicleAction } from './database';
import { useConnectionStore, useTelemetryStore, useTripStore, useFanStore } from './stores/app';
import { AndroidClassicTransport, BleTransport } from './transports';

let client: Elm327Client | undefined; let polling = false;
let controls: PriusCControls | undefined;
let fanTimer: ReturnType<typeof setTimeout> | undefined;
let fanGeneration = 0;
let fanAbort: AbortController | undefined;
let fanRefresh: (() => Promise<void>) | undefined;
let background = AppState.currentState !== undefined && AppState.currentState !== 'active';
export const stopBatteryFanControl = (): void => {
  fanGeneration += 1;
  fanAbort?.abort();
  fanAbort = undefined;
  fanRefresh = undefined;
  if (fanTimer) clearTimeout(fanTimer);
  fanTimer = undefined;
  useFanStore.getState().set({ level: null, busy: false, message: 'ხელით ბრძანებები შეჩერებულია · ავტომატურ რეჟიმში დაბრუნება ECU-ზეა დამოკიდებული' });
};
AppState.addEventListener('change', (state) => {
  background = state !== 'active';
  // BLE notifications wake iOS; do not depend on a suspended JS timer for the next fan request.
  if (background && useConnectionStore.getState().transport === 'BLE' && fanRefresh) {
    if (fanTimer) clearTimeout(fanTimer);
    fanTimer = undefined;
    void fanRefresh().catch(() => undefined);
  }
});
export const setBatteryFanLevel = async (level: number): Promise<void> => {
  if (!controls || !client || client.getState() !== 'READY') throw new Error('ჯერ დაუკავშირდი მანქანას');
  stopBatteryFanControl();
  const generation = fanGeneration;
  const abort = new AbortController(); fanAbort = abort;
  const activeControls = controls;
  let applying = false;
  const apply = async (): Promise<void> => {
    if (generation !== fanGeneration || applying) return;
    applying = true;
    useFanStore.getState().set({ busy: true, message: 'ქულერის პასუხს ვამოწმებ…' });
    try {
      await logVehicleAction('batteryFanManual', 'ATTEMPT', `level=${level}`);
      const actual = await activeControls.setFanLevel(level, () => generation === fanGeneration, abort.signal);
      await logVehicleAction('batteryFanManual', 'READBACK_CONFIRMED', `level=${actual}`);
      if (generation !== fanGeneration) return;
      useTelemetryStore.getState().batch([{ id: 'batteryFanRequestedLevel', value: actual, unit: 'level', timestamp: Date.now(), quality: 'VALID' }]);
      useFanStore.getState().set({ level: actual, busy: false, message: `ECU-მ დაადასტურა დონე ${actual} / 6` });
      applying = false;
      if (generation !== fanGeneration) return;
      if (background && useConnectionStore.getState().transport === 'BLE') {
        // Each cycle awaits native BLE replies, keeping the work tied to Bluetooth events.
        // No background timer or parallel writer is used.
        void apply().catch(() => undefined);
      } else {
        fanTimer = setTimeout(() => { fanTimer = undefined; void apply().catch(() => undefined); }, 1500);
      }
    } catch (error) {
      applying = false;
      if (generation !== fanGeneration) return;
      stopBatteryFanControl();
      const message = error instanceof Error ? error.message : String(error);
      useFanStore.getState().set({ message: `ვერ შესრულდა: ${message}. თუ ქულერი ხელით რეჟიმში დარჩა, გადატვირთე მანქანა.` });
      await logVehicleAction('batteryFanManual', 'FAILED', message).catch(() => undefined);
      throw error;
    }
  };
  fanRefresh = apply;
  await apply();
};
const timers = new Set<ReturnType<typeof setTimeout>>();
let trip: { id: string; aggregator: TripAggregator; batch: TelemetrySample[]; lastFlush: number } | undefined;

export const connectSimulator = async (): Promise<void> => connectTransport(new SimulatorTransport());

let scannedTransport: ObdTransport | undefined;

export const scanBluetoothAdapters = async (type: 'BLE' | 'ANDROID_CLASSIC'): Promise<DiscoveredAdapter[]> => {
  scannedTransport = type === 'BLE' ? new BleTransport() : new AndroidClassicTransport();
  return scannedTransport.scan();
};

export const connectBluetoothAdapter = async (adapter: DiscoveredAdapter): Promise<void> => {
  if (!scannedTransport) throw new Error('Scan for adapters first');
  const transport = scannedTransport; scannedTransport = undefined;
  await connectTransport(transport, adapter);
};

export const connectTransport = async (transport: ObdTransport, selectedAdapter?: DiscoveredAdapter): Promise<void> => {
  await disconnect(); useConnectionStore.getState().set({ status: 'CONNECTING', transport: transport.type, error: undefined });
  try {
    client = new Elm327Client(transport); const adapter = selectedAdapter ?? (await client.scan())[0]; if (!adapter) throw new Error('No adapter found');
    await client.connect(adapter); useConnectionStore.getState().set({ status: 'READY' });
    const supported = await discoverSupportedPids(client); polling = true;
    controls = new PriusCControls(client, (command, raw) => { void logVehicleAction(command, 'RESPONSE', raw).catch(() => undefined); });
    scheduleFuelPoll(client, controls);
    for (const definition of standardPids.filter((pid) => pid.id !== 'fuelLevel' && supported.has(pid.pid))) schedulePoll(definition);
  } catch (error) { useConnectionStore.getState().set({ status: 'ERROR', error: error instanceof Error ? error.message : String(error) }); throw error; }
};

export const disconnect = async (): Promise<void> => { stopBatteryFanControl(); controls = undefined; polling = false; for (const timer of timers) clearTimeout(timer); timers.clear(); useTelemetryStore.getState().markStale(); await finishTrip(); await client?.disconnect().catch(() => undefined); client = undefined; useConnectionStore.getState().set({ status: 'DISCONNECTED' }); };

export const readStoredDtcs = async (): Promise<{ raw: string; codes: string[] }> => {
  if (!client || client.getState() !== 'READY') throw new Error('Adapter is not ready');
  const result = await client.scheduler.enqueue({ id: 'dtc-stored', command: '03', priority: 'SAFETY_READ', timeoutMs: 5000, retries: 1 });
  const parsed = parseElmResponse(result.raw, '03'); const line = parsed.dataLines.find((value) => value.includes('43'));
  if (!line) throw new Error(parsed.statuses[0] ?? 'No valid DTC response');
  const payload = line.slice(line.indexOf('43') + 2); const bytes = Uint8Array.from(payload.match(/.{2}/g)?.map((x) => Number.parseInt(x, 16)) ?? []);
  const codes = parseMode03Dtcs(bytes); await saveDiagnosticScan(result.raw, codes); return { raw: result.raw, codes };
};

const discoverSupportedPids = async (elm: Elm327Client): Promise<Set<number>> => {
  const supported = new Set<number>();
  for (const base of [0x00, 0x20, 0x40]) {
    const command = `01${base.toString(16).padStart(2, '0')}`;
    const result = await elm.scheduler.enqueue({ id: `support-${base}`, command, priority: 'SAFETY_READ', timeoutMs: 2500, retries: 1 });
    const payload = extractMode01(parseElmResponse(result.raw, command).dataLines, base);
    if (!payload) break; for (const pid of parseSupportedPidBitmap(base, payload)) supported.add(pid);
    if (!supported.has(base + 0x20)) break;
  }
  return supported;
};

// Probe fuel independently of the support bitmap; Prius c usually exposes it via the combination meter.
const scheduleFuelPoll = (elm: Elm327Client, vehicle: PriusCControls): void => {
  let toyota = false;
  const run = async (): Promise<void> => {
    if (!polling || client !== elm) return;
    try {
      let percent: number | undefined;
      if (!toyota) {
        const result = await elm.scheduler.enqueue({ id: 'fuel-probe', command: '012F', priority: 'SLOW_TELEMETRY', timeoutMs: 2000 });
        const bytes = extractMode01(parseElmResponse(result.raw, '012F').dataLines, 0x2f);
        if (bytes?.length) percent = bytes[0]! * 100 / 255;
      }
      if (percent === undefined) { toyota = true; percent = Math.min(100, await vehicle.readFuelLitres() * 100 / 36); }
      if (client !== elm || !polling) return;
      const sample: TelemetrySample = { id: 'fuelLevel', value: percent, unit: '%', timestamp: Date.now(), quality: 'VALID' };
      useTelemetryStore.getState().batch([sample]);
      await recordTripSample(sample);
    } catch {
      const previous = useTelemetryStore.getState().values.fuelLevel;
      if (previous) useTelemetryStore.getState().batch([{ ...previous, quality: 'STALE' }]);
    }
    if (!polling || client !== elm) return;
    const timer = setTimeout(() => { timers.delete(timer); void run(); }, 5000); timers.add(timer);
  };
  void run();
};

const schedulePoll = (definition: ExecutableTelemetryDefinition): void => {
  const run = async (): Promise<void> => {
    if (!polling || !client) return;
    try {
      const result = await client.scheduler.enqueue({ id: definition.id, command: definition.request, priority: definition.priority, timeoutMs: 2000 });
      const bytes = extractMode01(parseElmResponse(result.raw, definition.request).dataLines, definition.pid);
      if (!bytes) throw new Error('No complete matching response');
      const sample: TelemetrySample = { id: definition.id, value: decodeStandardPid(definition, bytes), unit: definition.unit, timestamp: Date.now(), quality: 'VALID' };
      useTelemetryStore.getState().batch([sample]); useConnectionStore.getState().set({ latencyMs: result.latencyMs });
      await recordTripSample(sample);
    } catch {
      const previous = useTelemetryStore.getState().values[definition.id];
      if (previous && Date.now() - previous.timestamp > Math.max(5000, definition.pollingIntervalMs * 3)) useTelemetryStore.getState().batch([{ ...previous, quality: 'STALE' }]);
    }
    const interval = client?.scheduler.getStats().overloaded ? definition.pollingIntervalMs * 2 : definition.pollingIntervalMs;
    const timer = setTimeout(() => { timers.delete(timer); void run(); }, interval); timers.add(timer);
  }; void run();
};

const recordTripSample = async (sample: TelemetrySample): Promise<void> => {
  const values = useTelemetryStore.getState().values;
  const fresh = (id: string, maxAge = 2000): number | undefined => {
    const value = values[id];
    return value?.quality === 'VALID' && typeof value.value === 'number' && sample.timestamp >= value.timestamp && sample.timestamp - value.timestamp <= maxAge ? value.value : undefined;
  };
  const speed = fresh('speed'); const engineRpm = fresh('rpm'); const fuelRate = fresh('fuelRate'); const maf = fresh('maf');
  if (!trip && speed !== undefined && speed > 0) trip = { id: `trip-${Date.now()}`, aggregator: new TripAggregator(Date.now()), batch: [], lastFlush: Date.now() };
  if (!trip) return;
  trip.batch.push(sample); trip.aggregator.add({ timestamp: sample.timestamp, ...(speed !== undefined ? { speedKph: speed } : {}), ...(engineRpm !== undefined ? { engineRpm } : {}), ...(fuelRate !== undefined ? { fuelRateLph: fuelRate } : {}), ...(fuelRate === undefined && maf !== undefined ? { mafGps: maf } : {}) });
  const snapshot = trip.aggregator.snapshot(); useTripStore.getState().setActive({ id: trip.id, startedAt: snapshot.startedAt, durationSeconds: snapshot.durationSeconds, distanceKm: snapshot.distanceKm, fuelLitres: snapshot.fuelLitresEstimated, averageLitresPer100Km: snapshot.averageLitresPer100Km, sampleCount: snapshot.sampleCount, engineRunningKm: snapshot.engineRunningKm, engineOffKm: snapshot.engineOffKm, unknownPropulsionKm: snapshot.unknownPropulsionKm });
  if (Date.now() - trip.lastFlush >= 10_000) await flushTrip(false);
};

const flushTrip = async (ended: boolean): Promise<void> => {
  if (!trip) return; const current = trip; const snapshot = current.aggregator.snapshot(); const batch = current.batch.splice(0); current.lastFlush = Date.now();
  await appendTripSampleBatch(current.id, batch); await upsertTrip({ id: current.id, ...snapshot, ...(ended ? { endedAt: Date.now() } : {}) }); useTripStore.getState().historyChanged();
};

const finishTrip = async (): Promise<void> => { if (!trip) return; await flushTrip(true); trip = undefined; useTripStore.getState().setActive(undefined); };

const extractMode01 = (lines: string[], pid: number): Uint8Array | null => {
  try {
    const message = assembleIsoTp(lines).find((message) =>
      message.payload[0] === 0x41 && message.payload[1] === pid);
    return message ? message.payload.slice(2) : null;
  } catch { return null; }
};
