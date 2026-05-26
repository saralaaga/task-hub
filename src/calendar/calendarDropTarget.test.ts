import { calendarDropTargetParts, withCalendarDropTargetDate } from "./calendarDropTarget";

describe("calendar drop target helpers", () => {
  it("uses a bare date target for all-day task creation", () => {
    expect(calendarDropTargetParts("2026-05-26")).toEqual({ dateKey: "2026-05-26" });
    expect(withCalendarDropTargetDate("2026-05-26", "2026-05-27")).toBe("2026-05-27");
  });

  it("updates the date without losing time or duration details", () => {
    expect(withCalendarDropTargetDate(
      { dateKey: "2026-05-26", startMinutes: 570, durationMinutes: 75 },
      "2026-05-27"
    )).toEqual({
      dateKey: "2026-05-27",
      startMinutes: 570,
      durationMinutes: 75
    });
  });
});
