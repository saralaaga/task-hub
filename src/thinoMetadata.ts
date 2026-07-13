export function thinoIdFromIso(value: string): string {
  return value.replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function formatThinoCompatibleTimestamp(value: string, timezoneOffsetMinutes?: number): string {
  const localTimestampMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/u);
  const hasExplicitTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/u.test(value);
  if (localTimestampMatch && !hasExplicitTimezone) {
    const [, year, month, day, hour, minute, second] = localTimestampMatch;
    return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  if (timezoneOffsetMinutes !== undefined) {
    const shifted = new Date(parsed.getTime() + timezoneOffsetMinutes * 60_000);
    return formatDateParts(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
      shifted.getUTCSeconds()
    );
  }

  return formatDateParts(
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds()
  );
}

function formatDateParts(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
  return `${year}/${pad2(month)}/${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
