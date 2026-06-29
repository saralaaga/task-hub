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

  it("preserves timed reminder alerts during drag reschedules and clears alarms for all-day drops", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");
    const start = source.indexOf("func setReminderDue(store: EKEventStore)");
    const end = source.indexOf("func setReminderList(store: EKEventStore)", start);
    const setReminderDueSource = source.slice(start, end);

    expect(setReminderDueSource).toContain("let existingAlertMinutesBefore = reminderAlertMinutesBefore(reminder: reminder)");
    expect(setReminderDueSource).toContain("applyReminderAlert(reminder, alertMinutesBefore: existingAlertMinutesBefore)");
    expect(setReminderDueSource).toContain("reminder.alarms = nil");
  });

  it("can update Apple Reminder detail fields", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("case \"set-reminder-details\"");
    expect(source).toContain("func setReminderDetails(store: EKEventStore)");
    expect(source).toContain("reminder.title = title");
    expect(source).toContain("hasArgument(\"--clear-due\")");
    expect(source).toContain("hasArgument(\"--clear-alert\")");
    expect(source).toContain("applyReminderAlert(reminder, alertMinutesBefore: integerArgument(\"--alert-minutes-before\"))");
    expect(source).toContain("reminder.calendar = calendar");
  });

  it("can create Apple Reminder alerts only after a timed due date is set", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("func applyReminderAlert(_ reminder: EKReminder, alertMinutesBefore: Int?)");
    expect(source).toContain("reminder.dueDateComponents?.hour != nil");
    expect(source).toContain("reminder.addAlarm(EKAlarm(absoluteDate:");
  });

  it("includes Apple Reminder completion dates in helper output", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("let completionDate: String?");
    expect(source).toContain("completionDate: reminder.completionDate.map(isoString)");
  });

  it("can update Apple Calendar event detail fields", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("case \"set-calendar-event-details\"");
    expect(source).toContain("func setCalendarEventDetails(store: EKEventStore)");
    expect(source).toContain("event.title = title");
    expect(source).toContain("event.location = argumentValue(\"--location\")");
    expect(source).toContain("event.calendar = calendar");
  });

  it("can read and write simple EventKit recurrence rules", () => {
    const source = readFileSync(path.join(__dirname, "..", "apple-helper", "TaskHubAppleHelper.swift"), "utf8");

    expect(source).toContain("func recurrenceText(from item: EKCalendarItem)");
    expect(source).toContain("func recurrenceRule(from text: String?)");
    expect(source).toContain("applyRecurrence(to: reminder)");
    expect(source).toContain("applyRecurrence(to: event)");
    expect(source).toContain("argumentValue(\"--span\") == \"future\" ? .futureEvents : .thisEvent");
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
