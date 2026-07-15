export interface FuelAccumulatorState { fuelLitres: number; distanceKm: number; lastTimestamp?: number; source: 'DIRECT' | 'MAF_ESTIMATED' | 'NONE' }
export interface FuelSample { timestamp: number; speedKph?: number; fuelRateLph?: number; mafGps?: number; equivalenceRatio?: number }

export const initialFuelState = (): FuelAccumulatorState => ({ fuelLitres: 0, distanceKm: 0, source: 'NONE' });

export const integrateFuel = (state: FuelAccumulatorState, sample: FuelSample, gasolineDensityGramsPerLitre = 745, stoichiometricAirFuelRatio = 14.7): FuelAccumulatorState => {
  if (state.lastTimestamp === undefined) return { ...state, lastTimestamp: sample.timestamp };
  const elapsedHours = Math.min(Math.max(sample.timestamp - state.lastTimestamp, 0), 10_000) / 3_600_000;
  const speed = valid(sample.speedKph, 0, 300) ? sample.speedKph! : 0;
  let fuelRate: number | undefined;
  let source: FuelAccumulatorState['source'] = state.source;
  if (valid(sample.fuelRateLph, 0, 500)) { fuelRate = sample.fuelRateLph; source = 'DIRECT'; }
  else if (valid(sample.mafGps, 0, 1000)) {
    const ratio = stoichiometricAirFuelRatio * (valid(sample.equivalenceRatio, 0.5, 2) ? sample.equivalenceRatio! : 1);
    fuelRate = (sample.mafGps! / ratio / gasolineDensityGramsPerLitre) * 3600;
    source = 'MAF_ESTIMATED';
  }
  return {
    fuelLitres: state.fuelLitres + (fuelRate ?? 0) * elapsedHours,
    distanceKm: state.distanceKm + speed * elapsedHours,
    lastTimestamp: sample.timestamp,
    source,
  };
};

const valid = (value: number | undefined, min: number, max: number): boolean => value !== undefined && Number.isFinite(value) && value >= min && value <= max;

export const litresPer100Km = (state: FuelAccumulatorState, minimumDistanceKm = 0.1): number | null =>
  state.distanceKm < minimumDistanceKm ? null : state.fuelLitres / state.distanceKm * 100;
export const mpgUs = (l100: number | null): number | null => l100 && l100 > 0 ? 235.214583 / l100 : null;
export const mpgImperial = (l100: number | null): number | null => l100 && l100 > 0 ? 282.480936 / l100 : null;
export const kmPerLitre = (l100: number | null): number | null => l100 && l100 > 0 ? 100 / l100 : null;

export interface TripSnapshot {
  startedAt: number; durationSeconds: number; distanceKm: number; fuelLitresEstimated: number;
  averageLitresPer100Km: number | null; maxSpeed: number; averageSpeed: number; sampleCount: number;
  adapterDisconnectCount: number;
}

export class TripAggregator {
  private fuel = initialFuelState();
  private maxSpeed = 0;
  private sampleCount = 0;
  private disconnects = 0;
  constructor(private readonly startedAt = Date.now()) {}
  add(sample: FuelSample): void {
    this.fuel = integrateFuel(this.fuel, sample);
    this.maxSpeed = Math.max(this.maxSpeed, valid(sample.speedKph, 0, 300) ? sample.speedKph! : 0);
    this.sampleCount += 1;
  }
  recordDisconnect(): void { this.disconnects += 1; }
  snapshot(now = Date.now()): TripSnapshot {
    const durationSeconds = Math.max(0, (now - this.startedAt) / 1000);
    return { startedAt: this.startedAt, durationSeconds, distanceKm: this.fuel.distanceKm, fuelLitresEstimated: this.fuel.fuelLitres,
      averageLitresPer100Km: litresPer100Km(this.fuel), maxSpeed: this.maxSpeed,
      averageSpeed: durationSeconds > 0 ? this.fuel.distanceKm / (durationSeconds / 3600) : 0,
      sampleCount: this.sampleCount, adapterDisconnectCount: this.disconnects };
  }
}

export const parseMode03Dtcs = (bytes: Uint8Array): string[] => {
  const result: string[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const a = bytes[index]!; const b = bytes[index + 1]!;
    if (a === 0 && b === 0) continue;
    const family = ['P', 'C', 'B', 'U'][a >> 6]!;
    result.push(`${family}${((a >> 4) & 0x03).toString(16)}${(a & 0x0f).toString(16)}${(b >> 4).toString(16)}${(b & 0x0f).toString(16)}`.toUpperCase());
  }
  return result;
};

export interface SafetyContext { speedKph?: number; gear?: string; batteryTemperatureC?: number; oemRequestedLevel?: number; profileMatches: boolean }
export const canExecuteVehicleWrite = (status: string, context: SafetyContext): { allowed: boolean; reason?: string } => {
  if (status !== 'TESTED_WRITE' && status !== 'PRODUCTION_APPROVED') return { allowed: false, reason: 'Command is not write-verified' };
  if (!context.profileMatches) return { allowed: false, reason: 'Vehicle profile mismatch' };
  return { allowed: true };
};
