/** Stable formatting: no grouping or variable decimal precision in live cards. */
export const formatLiveNumber = (value: unknown, digits = 0): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
export const formatElapsed = (seconds: unknown): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 3600).toString().padStart(2, '0')}:${Math.floor(whole % 3600 / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
};
export const fuelLitres = (percent: unknown, tankCapacityLitres = 36): number | undefined =>
  typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent * tankCapacityLitres / 100 : undefined;
