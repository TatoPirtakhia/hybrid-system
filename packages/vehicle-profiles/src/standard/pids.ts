import type { ExecutableTelemetryDefinition } from '../types';

const standard = (id: string, label: string, unit: string, pid: number, decoder: ExecutableTelemetryDefinition['decode']['decoder'], pollingIntervalMs: number, validRange?: { min: number; max: number }): ExecutableTelemetryDefinition => ({
  id, label, unit, executable: true, ecuId: 'powertrain', service: 1, pid,
  request: `01${pid.toString(16).padStart(2, '0').toUpperCase()}`,
  decode: { kind: 'BUILT_IN', decoder }, pollingIntervalMs,
  priority: pollingIntervalMs <= 500 ? 'FAST_TELEMETRY' : 'NORMAL_TELEMETRY',
  ...(validRange ? { validRange } : {}),
  verificationStatus: 'PRODUCTION_APPROVED',
  sourceReference: 'SAE J1979 / ISO 15031-5 standard OBD-II service 01',
});

export const standardPids: ExecutableTelemetryDefinition[] = [
  standard('speed', 'Vehicle speed', 'km/h', 0x0d, 'A', 250, { min: 0, max: 255 }),
  standard('rpm', 'Engine RPM', 'rpm', 0x0c, 'AB_DIV_4', 250, { min: 0, max: 16383.75 }),
  standard('coolantTemperature', 'Coolant', '°C', 0x05, 'A_MINUS_40', 1000, { min: -40, max: 215 }),
  standard('maf', 'Mass air flow', 'g/s', 0x10, 'AB_DIV_100', 500, { min: 0, max: 655.35 }),
  standard('moduleVoltage', 'Module voltage', 'V', 0x42, 'AB_DIV_100', 5000, { min: 0, max: 65.535 }),
  standard('fuelRate', 'Fuel rate', 'L/h', 0x5e, 'AB_TIMES_005', 500, { min: 0, max: 3276.75 }),
];

export const decodeStandardPid = (definition: ExecutableTelemetryDefinition, bytes: Uint8Array): number => {
  const a = bytes[0];
  if (a === undefined) throw new Error('Missing PID data');
  const b = bytes[1] ?? 0;
  const value = definition.decode.decoder === 'A' ? a
    : definition.decode.decoder === 'AB_DIV_4' ? (a * 256 + b) / 4
    : definition.decode.decoder === 'A_MINUS_40' ? a - 40
    : definition.decode.decoder === 'AB_DIV_100' ? (a * 256 + b) / 100
    : definition.decode.decoder === 'AB_TIMES_005' ? (a * 256 + b) * 0.05
    : a * 256 + b;
  if (definition.validRange && (value < definition.validRange.min || value > definition.validRange.max)) throw new Error('Decoded value outside valid range');
  return value;
};

export const parseSupportedPidBitmap = (basePid: number, bytes: Uint8Array): Set<number> => {
  if (bytes.length < 4) throw new Error('Incomplete supported PID bitmap');
  const result = new Set<number>();
  for (let byte = 0; byte < 4; byte += 1) for (let bit = 0; bit < 8; bit += 1) {
    if ((bytes[byte]! & (1 << (7 - bit))) !== 0) result.add(basePid + byte * 8 + bit + 1);
  }
  return result;
};
