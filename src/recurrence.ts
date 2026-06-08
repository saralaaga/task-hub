export type RecurrencePreset = "" | "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceEditScope = "this" | "future";

export const RECURRENCE_PRESETS: RecurrencePreset[] = ["", "daily", "weekly", "monthly", "yearly"];

const PRESET_RULES: Record<Exclude<RecurrencePreset, "">, string> = {
  daily: "RRULE:FREQ=DAILY",
  weekly: "RRULE:FREQ=WEEKLY",
  monthly: "RRULE:FREQ=MONTHLY",
  yearly: "RRULE:FREQ=YEARLY"
};

type ParsedRecurrence = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  until?: string;
};

export function recurrenceRuleFromPreset(preset: RecurrencePreset): string | undefined {
  return preset ? PRESET_RULES[preset] : undefined;
}

export function recurrencePresetFromRule(rule: string | undefined): RecurrencePreset | "custom" {
  const normalized = normalizeRecurrenceRule(rule);
  if (!normalized) return "";
  for (const preset of RECURRENCE_PRESETS) {
    if (preset && PRESET_RULES[preset] === normalized) return preset;
  }
  return "custom";
}

export function normalizeRecurrenceRule(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const withoutPrefix = trimmed.replace(/^repeat::\s*/iu, "").replace(/^🔁\s*/u, "");
  const body = /^RRULE:/iu.test(withoutPrefix) ? withoutPrefix.slice("RRULE:".length) : withoutPrefix;
  const parts = body
    .split(";")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (!parts.some((part) => /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)$/u.test(part))) return undefined;
  return `RRULE:${parts.join(";")}`;
}

export function nextRecurrenceDate(dateKey: string | undefined, rule: string | undefined): string | undefined {
  const date = parseDateKey(dateKey);
  const recurrence = parseRecurrence(rule);
  if (!date || !recurrence) return undefined;

  const next = addInterval(date, recurrence.frequency, recurrence.interval);
  const nextKey = formatDateKey(next);
  if (recurrence.until && nextKey > recurrence.until) return undefined;
  return nextKey;
}

export function recurrenceDatesBetween(startKey: string | undefined, rule: string | undefined, untilKey: string | undefined): string[] {
  const start = parseDateKey(startKey);
  const until = parseDateKey(untilKey);
  const recurrence = parseRecurrence(rule);
  if (!start || !until || !recurrence || until < start) return [];

  const dates: string[] = [];
  let cursor = start;
  while (cursor <= until) {
    const key = formatDateKey(cursor);
    if (!recurrence.until || key <= recurrence.until) dates.push(key);
    const next = addInterval(cursor, recurrence.frequency, recurrence.interval);
    if (next <= cursor) break;
    cursor = next;
  }
  return dates;
}

function parseRecurrence(rule: string | undefined): ParsedRecurrence | undefined {
  const normalized = normalizeRecurrenceRule(rule);
  if (!normalized) return undefined;
  const entries = new Map<string, string>();
  for (const part of normalized.slice("RRULE:".length).split(";")) {
    const [key, value] = part.split("=");
    if (key && value) entries.set(key, value);
  }
  const frequency = entries.get("FREQ");
  if (frequency !== "DAILY" && frequency !== "WEEKLY" && frequency !== "MONTHLY" && frequency !== "YEARLY") return undefined;
  const interval = Math.max(1, Number.parseInt(entries.get("INTERVAL") ?? "1", 10) || 1);
  const until = entries.get("UNTIL")?.slice(0, 10).replace(/^(\d{4})(\d{2})(\d{2})$/u, "$1-$2-$3");
  return { frequency, interval, until };
}

function addInterval(date: Date, frequency: ParsedRecurrence["frequency"], interval: number): Date {
  if (frequency === "DAILY") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + interval);
  if (frequency === "WEEKLY") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + interval * 7);
  if (frequency === "YEARLY") return clampedDate(date.getFullYear() + interval, date.getMonth(), date.getDate());
  return clampedDate(date.getFullYear(), date.getMonth() + interval, date.getDate());
}

function clampedDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function parseDateKey(value: string | undefined): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return formatDateKey(date) === value ? date : undefined;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
