import { readFileSync } from "fs";
import * as path from "path";

describe("Apple helper source", () => {
  it("looks up Apple Calendar events by eventIdentifier before falling back to calendarItemIdentifier", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("store.event(withIdentifier: id) ?? store.calendarItem(withIdentifier: id) as? EKEvent");
  });

  it("deletes Apple Calendar events by eventIdentifier before falling back to calendarItemIdentifier", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");
    const start = source.indexOf("func deleteCalendarEvent(store: EKEventStore)");
    const end = source.indexOf("@main", start);
    const deleteSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(deleteSource).toContain("store.event(withIdentifier: id) ?? store.calendarItem(withIdentifier: id) as? EKEvent");
  });

  it("can create all-day Apple Calendar events from dated tasks", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("case \"create-calendar-event\"");
    expect(source).toContain("func createCalendarEvent(store: EKEventStore)");
    expect(source).toContain("event.isAllDay = true");
    expect(source).toContain("store.defaultCalendarForNewEvents");
  });

  it("can create and reschedule timed Apple Calendar events", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("integerArgument(\"--start-minutes\")");
    expect(source).toContain("integerArgument(\"--duration-minutes\")");
    expect(source).toContain("event.isAllDay = false");
    expect(source).toContain("dateTime(on: nextStart");
    expect(source).toContain("dateTime(on: startDate");
  });

  it("can set Apple Reminder due times to a specific minute", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");
    const start = source.indexOf("func setReminderDue(store: EKEventStore)");
    const end = source.indexOf("func setReminderList(store: EKEventStore)", start);
    const setReminderDueSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(setReminderDueSource).toContain(
      "reminder.dueDateComponents = dueDateComponents(from: argumentValue(\"--due\"), startMinutes: integerArgument(\"--start-minutes\"))"
    );
  });

  it("can list Apple calendars with identifiers, colors, and writability", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("case \"calendar-lists\"");
    expect(source).toContain("func readCalendarLists(store: EKEventStore)");
    expect(source).toContain("id: calendar.calendarIdentifier");
    expect(source).toContain("color: hexColor(from: calendar)");
    expect(source).toContain("writable: calendar.allowsContentModifications");
  });
});
