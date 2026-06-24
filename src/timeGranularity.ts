export const MIN_TIME_GRANULARITY_MINUTES = 5;
export const MAX_TIMED_START_MINUTES = 24 * 60 - MIN_TIME_GRANULARITY_MINUTES;

export function snapToTimeGranularity(minutes: number): number {
  return Math.round(minutes / MIN_TIME_GRANULARITY_MINUTES) * MIN_TIME_GRANULARITY_MINUTES;
}

export function snapDayStartMinutes(minutes: number): number {
  return Math.max(0, Math.min(MAX_TIMED_START_MINUTES, snapToTimeGranularity(minutes)));
}

export function validTimedDurationMinutes(minutes: number | undefined, defaultMinutes: number): number {
  if (!Number.isFinite(minutes) || minutes === undefined) return defaultMinutes;
  return Math.max(MIN_TIME_GRANULARITY_MINUTES, Math.min(24 * 60, Math.round(minutes)));
}
