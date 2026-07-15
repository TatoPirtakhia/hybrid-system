import { create } from 'zustand';
import type { TelemetrySample } from '@prius/shared';

interface ConnectionState { status: 'DISCONNECTED' | 'CONNECTING' | 'READY' | 'ERROR'; transport: 'SIMULATOR' | 'BLE' | 'WIFI' | 'ANDROID_CLASSIC'; latencyMs?: number | undefined; error?: string | undefined; set: (value: Partial<ConnectionState>) => void }
export const useConnectionStore = create<ConnectionState>((set) => ({ status: 'DISCONNECTED', transport: 'SIMULATOR', set: (value) => set(value) }));

interface TelemetryState { values: Record<string, TelemetrySample>; batch: (samples: TelemetrySample[]) => void; markStale: () => void }
export const useTelemetryStore = create<TelemetryState>((set) => ({ values: {}, batch: (samples) => set((state) => ({ values: { ...state.values, ...Object.fromEntries(samples.map((s) => [s.id, s])) } })), markStale: () => set((state) => ({ values: Object.fromEntries(Object.entries(state.values).map(([id, sample]) => [id, { ...sample, quality: 'STALE' }])) })) }));

interface SettingsState { safetyAccepted: boolean; keepAwake: boolean; units: 'L_100KM' | 'MPG_US'; setSafetyAccepted: (value: boolean) => void; toggleKeepAwake: () => void }
export const useSettingsStore = create<SettingsState>((set) => ({ safetyAccepted: false, keepAwake: true, units: 'L_100KM', setSafetyAccepted: (safetyAccepted) => set({ safetyAccepted }), toggleKeepAwake: () => set((s) => ({ keepAwake: !s.keepAwake })) }));

export interface TripSummary { id: string; startedAt: number; durationSeconds: number; distanceKm: number; fuelLitres: number; averageLitresPer100Km: number | null; sampleCount: number }
interface TripState { active?: TripSummary | undefined; historyVersion: number; setActive: (active?: TripSummary) => void; historyChanged: () => void }
export const useTripStore = create<TripState>((set) => ({ historyVersion: 0, setActive: (active) => set({ active }), historyChanged: () => set((s) => ({ historyVersion: s.historyVersion + 1 })) }));
