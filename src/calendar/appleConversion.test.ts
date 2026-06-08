import { appleCalendarEventToReminderInput, appleReminderToCalendarEventInput } from "./appleConversion";
import type { CalendarEvent, TaskItem } from "../types";

describe("Apple Calendar and Reminders conversion", () => {
  test("converts a timed Apple Calendar event to a reminder at the event start without preserving duration", () => {
    const event: CalendarEvent = {
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Design review",
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T11:00:00",
      allDay: false,
      calendarName: "Work",
      location: "Room 3",
      description: "Bring notes"
    };

    expect(appleCalendarEventToReminderInput(event, "inbox")).toEqual({
      title: "Design review",
      dueDate: "2026-05-20",
      startMinutes: 570,
      listId: "inbox",
      notes: "Converted from Apple Calendar by Task Hub.\nCalendar: Work\nLocation: Room 3\nBring notes"
    });
  });

  test("converts a timed Apple Reminder to a calendar event using the default duration", () => {
    const task = appleReminderTask({
      scheduledDate: "2026-05-21T14:15:00",
      dueDate: "2026-05-21"
    });

    expect(appleReminderToCalendarEventInput(task, 45, "calendar-1")).toEqual({
      title: "Follow up",
      date: "2026-05-21",
      startMinutes: 855,
      durationMinutes: 45,
      calendarId: "calendar-1",
      notes: "Converted from Apple Reminders by Task Hub.\nList: Personal"
    });
  });

  test("converts a date-only Apple Reminder to an all-day calendar event", () => {
    const task = appleReminderTask({ dueDate: "2026-05-22" });

    expect(appleReminderToCalendarEventInput(task, 60)).toEqual({
      title: "Follow up",
      date: "2026-05-22",
      startMinutes: undefined,
      durationMinutes: undefined,
      calendarId: undefined,
      notes: "Converted from Apple Reminders by Task Hub.\nList: Personal"
    });
  });

  test("preserves recurrence when converting between Apple sources", () => {
    expect(appleCalendarEventToReminderInput({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Review",
      start: "2026-05-20",
      allDay: true,
      recurrence: "RRULE:FREQ=WEEKLY"
    })).toMatchObject({ recurrence: "RRULE:FREQ=WEEKLY" });

    expect(appleReminderToCalendarEventInput(appleReminderTask({
      dueDate: "2026-05-20",
      recurrence: "RRULE:FREQ=MONTHLY"
    }), 60)).toMatchObject({ recurrence: "RRULE:FREQ=MONTHLY" });
  });
});

function appleReminderTask(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: "task-1",
    filePath: "Apple Reminders",
    line: 0,
    rawLine: "",
    text: "Follow up",
    completed: false,
    tags: [],
    source: "apple-reminders",
    externalId: "reminder-1",
    externalSourceName: "Personal",
    ...overrides
  };
}
