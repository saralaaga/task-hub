import { nextRecurrenceDate, normalizeRecurrenceRule, recurrenceDatesBetween, recurrencePresetFromRule, recurrenceRuleFromPreset } from "./recurrence";

describe("recurrence helpers", () => {
  it("normalizes supported RRULE strings", () => {
    expect(normalizeRecurrenceRule("repeat:: rrule:freq=weekly;interval=2")).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2");
    expect(normalizeRecurrenceRule("not a rule")).toBeUndefined();
  });

  it("maps common presets to rules", () => {
    expect(recurrenceRuleFromPreset("weekly")).toBe("RRULE:FREQ=WEEKLY");
    expect(recurrencePresetFromRule("RRULE:FREQ=MONTHLY")).toBe("monthly");
    expect(recurrencePresetFromRule("RRULE:FREQ=WEEKLY;INTERVAL=2")).toBe("custom");
  });

  it("computes the next common occurrence date", () => {
    expect(nextRecurrenceDate("2026-06-08", "RRULE:FREQ=DAILY")).toBe("2026-06-09");
    expect(nextRecurrenceDate("2026-06-08", "RRULE:FREQ=WEEKLY")).toBe("2026-06-15");
    expect(nextRecurrenceDate("2026-01-31", "RRULE:FREQ=MONTHLY")).toBe("2026-02-28");
    expect(nextRecurrenceDate("2026-06-08", "RRULE:FREQ=YEARLY")).toBe("2027-06-08");
  });

  it("expands event recurrence into concrete occurrence dates", () => {
    expect(recurrenceDatesBetween("2026-06-01", "RRULE:FREQ=WEEKLY", "2026-06-15")).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15"
    ]);
    expect(recurrenceDatesBetween("2026-06-01", "RRULE:FREQ=WEEKLY", "2026-05-31")).toEqual([]);
  });
});
