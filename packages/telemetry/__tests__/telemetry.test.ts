import { initialFuelState, integrateFuel, litresPer100Km, parseMode03Dtcs, canExecuteVehicleWrite } from '../src';
describe('fuel integration', () => {
  it('integrates direct fuel and distance', () => {
    let state = integrateFuel(initialFuelState(), { timestamp: 0, speedKph: 100, fuelRateLph: 5 });
    state = integrateFuel(state, { timestamp: 10_000, speedKph: 100, fuelRateLph: 5 });
    expect(state.distanceKm).toBeCloseTo(0.27778); expect(state.fuelLitres).toBeCloseTo(0.01389); expect(litresPer100Km(state)).toBeCloseTo(5);
  });
  it('does not show an average before minimum distance', () => expect(litresPer100Km({ fuelLitres: 0, distanceKm: 0, source: 'NONE' })).toBeNull());
});
describe('diagnostics and writes', () => {
  it('parses standard DTC bytes', () => expect(parseMode03Dtcs(Uint8Array.of(0x01, 0x33))).toEqual(['P0133']));
  it('blocks unverified writes', () => expect(canExecuteVehicleWrite('UNVERIFIED', { profileMatches: true }).allowed).toBe(false));
});

import { TripAggregator } from '../src';
it('splits session distance by fresh RPM without inventing a propulsion source', () => {
  const trip = new TripAggregator(0);
  trip.add({ timestamp: 0, speedKph: 36, engineRpm: 1200 });
  trip.add({ timestamp: 10000, speedKph: 36, engineRpm: 1200 });
  trip.add({ timestamp: 20000, speedKph: 36, engineRpm: 0 });
  trip.add({ timestamp: 30000, speedKph: 36 });
  trip.add({ timestamp: 40000, speedKph: 36, engineRpm: NaN });
  const result = trip.snapshot(40000);
  expect(result.distanceKm).toBeCloseTo(0.4);
  expect(result.engineRunningKm).toBeCloseTo(0.1);
  expect(result.engineOffKm).toBeCloseTo(0.1);
  expect(result.unknownPropulsionKm).toBeCloseTo(0.2);
  expect(result.engineRunningKm + result.engineOffKm + result.unknownPropulsionKm).toBeCloseTo(result.distanceKm);
});
it('does not add distance while stopped or across an unlimited telemetry gap', () => {
  const trip = new TripAggregator(0);
  trip.add({ timestamp: 0, speedKph: 36, engineRpm: 1000 });
  trip.add({ timestamp: 300000, speedKph: 36, engineRpm: 0 });
  trip.add({ timestamp: 310000, speedKph: 0, engineRpm: 1000 });
  expect(trip.snapshot().distanceKm).toBeCloseTo(0.1);
});
