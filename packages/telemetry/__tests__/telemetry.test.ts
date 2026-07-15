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
