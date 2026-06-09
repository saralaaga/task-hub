import type { Translator } from "./i18n";

export type ReminderAlertMinutes = 0 | 5 | 10 | 15 | 30 | 60 | 1440 | 2880 | 10080;

export const REMINDER_ALERT_OPTIONS: ReminderAlertMinutes[] = [0, 5, 10, 15, 30, 60, 1440, 2880, 10080];

export function normalizeReminderAlertMinutes(value: unknown): ReminderAlertMinutes | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return (REMINDER_ALERT_OPTIONS as number[]).includes(rounded) ? rounded as ReminderAlertMinutes : undefined;
}

export function reminderAlertOptionLabel(minutes: ReminderAlertMinutes, t: Translator): string {
  if (minutes === 0) return t("reminderAlertAtTime");
  if (minutes < 60) return t("reminderAlertMinutesBefore").replace("{minutes}", String(minutes));
  if (minutes === 60) return t("reminderAlertOneHourBefore");
  if (minutes === 1440) return t("reminderAlertOneDayBefore");
  if (minutes === 2880) return t("reminderAlertTwoDaysBefore");
  return t("reminderAlertOneWeekBefore");
}

export function populateReminderAlertSelect(select: HTMLSelectElement, t: Translator, options: { includeNone?: boolean } = {}): void {
  select.empty();
  if (options.includeNone) {
    select.createEl("option", {
      value: "",
      text: t("reminderAlertNone")
    });
  }
  for (const minutes of REMINDER_ALERT_OPTIONS) {
    select.createEl("option", {
      value: String(minutes),
      text: reminderAlertOptionLabel(minutes, t)
    });
  }
}
