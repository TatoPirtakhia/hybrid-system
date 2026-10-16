import { formatElapsed, formatLiveNumber, fuelLitres } from '../src/dashboard-values';
test('formats live values with stable precision including absent and invalid samples', () => {
  expect(formatLiveNumber(undefined)).toBe('—');
  expect(formatLiveNumber(NaN)).toBe('—');
  expect(formatLiveNumber(Infinity)).toBe('—');
  expect(formatLiveNumber(9.95, 1)).toBe('9.9');
  expect(formatLiveNumber(100.01, 1)).toBe('100.0');
  expect(formatLiveNumber(1234.9)).toBe('1235');
});
test('keeps elapsed time fixed-width and does not turn missing data into zero', () => {
  expect(formatElapsed(undefined)).toBe('—');
  expect(formatElapsed(-1)).toBe('—');
  expect(formatElapsed(0)).toBe('00:00:00');
  expect(formatElapsed(3661)).toBe('01:01:01');
});
test('tank conversion is an estimate from a bounded ECU percentage', () => {
  expect(fuelLitres(undefined)).toBeUndefined();
  expect(fuelLitres(101)).toBeUndefined();
  expect(fuelLitres(-1)).toBeUndefined();
  expect(fuelLitres(0)).toBe(0);
  expect(fuelLitres(50)).toBe(18);
  expect(fuelLitres(100)).toBe(36);
});
