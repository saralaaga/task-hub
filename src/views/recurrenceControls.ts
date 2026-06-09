import type { Translator } from "../i18n";
import { RECURRENCE_PRESETS, normalizeRecurrenceRule, recurrencePresetFromRule, recurrenceRuleFromPreset } from "../recurrence";

export function createRecurrenceSelect(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  t: Translator
): HTMLSelectElement {
  const row = container.createDiv({ cls: "task-hub-detail-row task-hub-calendar-detail-row" });
  row.createDiv({ cls: "task-hub-detail-icon-cell" });
  row.createSpan({ cls: "task-hub-detail-label", text: label });
  const control = row.createDiv({ cls: "task-hub-detail-control" });
  const select = control.createEl("select", { cls: "task-hub-recurrence-select" }) as HTMLSelectElement;
  populateRecurrenceSelect(select, value, t);
  return select;
}

export function populateRecurrenceSelect(select: HTMLSelectElement, value: string | undefined, t: Translator): void {
  while (select.firstChild) select.removeChild(select.firstChild);
  const normalized = normalizeRecurrenceRule(value);
  const preset = recurrencePresetFromRule(normalized);
  for (const option of recurrenceOptions(t)) {
    select.createEl("option", option);
  }
  if (normalized && preset === "custom") {
    select.createEl("option", { value: normalized, text: t("recurrenceCustom") });
  }
  select.value = normalized ?? "";
}

export function recurrenceValueFromSelect(select: HTMLSelectElement): string | null {
  return normalizeRecurrenceRule(select.value) ?? null;
}

function recurrenceOptions(t: Translator): Array<{ value: string; text: string }> {
  return RECURRENCE_PRESETS.map((preset) => ({
    value: recurrenceRuleFromPreset(preset) ?? "",
    text: recurrenceLabel(preset, t)
  }));
}

function recurrenceLabel(preset: (typeof RECURRENCE_PRESETS)[number], t: Translator): string {
  if (preset === "daily") return t("recurrenceDaily");
  if (preset === "weekly") return t("recurrenceWeekly");
  if (preset === "monthly") return t("recurrenceMonthly");
  if (preset === "yearly") return t("recurrenceYearly");
  return t("recurrenceNone");
}
