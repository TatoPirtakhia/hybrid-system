export type VerificationStatus =
  | 'UNVERIFIED'
  | 'TESTED_READ_ONLY'
  | 'TESTED_WRITE'
  | 'PRODUCTION_APPROVED';

export type CommandPriority =
  | 'CRITICAL_WRITE'
  | 'SAFETY_READ'
  | 'FAST_TELEMETRY'
  | 'NORMAL_TELEMETRY'
  | 'SLOW_TELEMETRY'
  | 'BACKGROUND';

export type TelemetryQuality = 'VALID' | 'STALE' | 'UNSUPPORTED' | 'INVALID';

export interface TelemetrySample {
  id: string;
  value: number | string | boolean;
  unit: string;
  timestamp: number;
  quality: TelemetryQuality;
  estimated?: boolean;
}

export const isWriteApproved = (status: VerificationStatus): boolean =>
  status === 'TESTED_WRITE' || status === 'PRODUCTION_APPROVED';

export const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/\s/g, '').toUpperCase();
  if (!/^[0-9A-F]*$/.test(normalized) || normalized.length % 2 !== 0 || normalized.length > 4096) {
    throw new Error('Invalid hexadecimal command');
  }
  return Uint8Array.from(normalized.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
};

export const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
