import { Elm327Client, SimulatorTransport, parseElmResponse } from '@prius/elm327';
import { standardPids, decodeStandardPid, parseSupportedPidBitmap, type ExecutableTelemetryDefinition } from '@prius/vehicle-profiles';
import type { ObdTransport } from '@prius/obd-core';
import type { TelemetrySample } from '@prius/shared';
import { TripAggregator, parseMode03Dtcs } from '@prius/telemetry';
import { appendTripSampleBatch, saveDiagnosticScan, upsertTrip } from './database';
import { useConnectionStore, useTelemetryStore, useTripStore } from './stores/app';

let client: Elm327Client | undefined; let polling = false;
const timers = new Set<ReturnType<typeof setTimeout>>();
let trip: { id: string; aggregator: TripAggregator; batch: TelemetrySample[]; lastFlush: number } | undefined;

export const connectSimulator = async (): Promise<void> => connectTransport(new SimulatorTransport());

export const connectTransport = async (transport: ObdTransport): Promise<void> => {
  await disconnect(); useConnectionStore.getState().set({ status: 'CONNECTING', transport: transport.type, error: undefined });
  try {
    client = new Elm327Client(transport); const adapters = await client.scan(); const adapter = adapters[0]; if (!adapter) throw new Error('No adapter found');
    await client.connect(adapter); useConnectionStore.getState().set({ status: 'READY' });
    const supported = await discoverSupportedPids(client); polling = true;
    for (const definition of standardPids.filter((pid) => supported.has(pid.pid))) schedulePoll(definition);
  } catch (error) { useConnectionStore.getState().set({ status: 'ERROR', error: error instanceof Error ? error.message : String(error) }); throw error; }
};

export const disconnect = async (): Promise<void> => { polling = false; for (const timer of timers) clearTimeout(timer); timers.clear(); useTelemetryStore.getState().markStale(); await finishTrip(); await client?.disconnect().catch(() => undefined); client = undefined; useConnectionStore.getState().set({ status: 'DISCONNECTED' }); };

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
    } catch { /* retain last value until stale timeout/reconnect */ }
    const interval = client.scheduler.getStats().overloaded ? definition.pollingIntervalMs * 2 : definition.pollingIntervalMs;
    const timer = setTimeout(() => { timers.delete(timer); void run(); }, interval); timers.add(timer);
  }; void run();
};

const recordTripSample = async (sample: TelemetrySample): Promise<void> => {
  const values = useTelemetryStore.getState().values; const speed = Number(values.speed?.value); const fuelRate = Number(values.fuelRate?.value); const maf = Number(values.maf?.value);
  if (!trip && Number.isFinite(speed) && speed > 0) trip = { id: `trip-${Date.now()}`, aggregator: new TripAggregator(Date.now()), batch: [], lastFlush: Date.now() };
  if (!trip) return;
  trip.batch.push(sample); trip.aggregator.add({ timestamp: sample.timestamp, ...(Number.isFinite(speed) ? { speedKph: speed } : {}), ...(Number.isFinite(fuelRate) ? { fuelRateLph: fuelRate } : {}), ...(!Number.isFinite(fuelRate) && Number.isFinite(maf) ? { mafGps: maf } : {}) });
  const snapshot = trip.aggregator.snapshot(); useTripStore.getState().setActive({ id: trip.id, startedAt: snapshot.startedAt, durationSeconds: snapshot.durationSeconds, distanceKm: snapshot.distanceKm, fuelLitres: snapshot.fuelLitresEstimated, averageLitresPer100Km: snapshot.averageLitresPer100Km, sampleCount: snapshot.sampleCount });
  if (Date.now() - trip.lastFlush >= 10_000) await flushTrip(false);
};

const flushTrip = async (ended: boolean): Promise<void> => {
  if (!trip) return; const current = trip; const snapshot = current.aggregator.snapshot(); const batch = current.batch.splice(0); current.lastFlush = Date.now();
  await appendTripSampleBatch(current.id, batch); await upsertTrip({ id: current.id, ...snapshot, ...(ended ? { endedAt: Date.now() } : {}) }); useTripStore.getState().historyChanged();
};

const finishTrip = async (): Promise<void> => { if (!trip) return; await flushTrip(true); trip = undefined; useTripStore.getState().setActive(undefined); };

const extractMode01 = (lines: string[], pid: number): Uint8Array | null => {
  const expected = `41${pid.toString(16).padStart(2, '0').toUpperCase()}`;
  for (const line of lines) {
    const index = line.indexOf(expected); if (index < 0) continue;
    const payload = line.slice(index + expected.length); if (payload.length % 2 !== 0) continue;
    return Uint8Array.from(payload.match(/.{2}/g)?.map((x) => Number.parseInt(x, 16)) ?? []);
  }
  return null;
};
