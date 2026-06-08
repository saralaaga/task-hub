import type { CalendarEvent, TaskItem } from "../types";

export type AppleReminderCreationInput = {
  title: string;
  notes?: string;
  dueDate?: string;
  startMinutes?: number;
  listId?: string;
  recurrence?: string;
};

export type AppleCalendarEventCreationInput = {
  title: string;
  date: string;
  notes?: string;
  startMinutes?: number;
  durationMinutes?: number;
  calendarId?: string;
  recurrence?: string;
};

export function appleCalendarEventToReminderInput(
  event: CalendarEvent,
  defaultListId?: string
): AppleReminderCreationInput {
  const start = parseCalendarDateTime(event.start);
  return {
    title: event.title,
    notes: appleCalendarEventConversionNotes(event),
    dueDate: start.date,
    startMinutes: event.allDay ? undefined : start.minutes,
    listId: defaultListId,
    ...(event.recurrence ? { recurrence: event.recurrence } : {})
  };
}

export function appleReminderToCalendarEventInput(
  task: TaskItem,
  defaultDurationMinutes: number,
  calendarId?: string
): AppleCalendarEventCreationInput {
  const scheduled = parseCalendarDateTime(task.scheduledDate);
  const due = task.dueDate ?? scheduled.date;
  if (!due) {
    throw new Error("Apple Reminder must have a date before it can be converted to Apple Calendar.");
  }

  return {
    title: task.text,
    notes: appleReminderConversionNotes(task),
    date: due,
    startMinutes: scheduled.minutes,
    durationMinutes: scheduled.minutes === undefined ? undefined : validDurationMinutes(defaultDurationMinutes),
    calendarId,
    ...(task.recurrence ? { recurrence: task.recurrence } : {})
  };
}

function appleCalendarEventConversionNotes(event: CalendarEvent): string | undefined {
  return [
    "Converted from Apple Calendar by Task Hub.",
    event.calendarName ? `Calendar: ${event.calendarName}` : undefined,
    event.location ? `Location: ${event.location}` : undefined,
    event.description,
    event.url
  ]
    .filter(Boolean)
    .join("\n") || undefined;
}

function appleReminderConversionNotes(task: TaskItem): string | undefined {
  return [
    "Converted from Apple Reminders by Task Hub.",
    task.externalSourceName ? `List: ${task.externalSourceName}` : undefined,
    task.contextPreview,
    task.externalUrl
  ]
    .filter(Boolean)
    .join("\n") || undefined;
}

function validDurationMinutes(value: number): number {
  return Math.max(1, Math.min(365 * 24 * 60, Math.round(value)));
}

function parseCalendarDateTime(value: string | undefined): { date?: string; minutes?: number } {
  if (!value) return {};

  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasExplicitZone) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: localDateKey(date),
        minutes: date.getHours() * 60 + date.getMinutes()
      };
    }
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return {};
  return {
    date: match[1],
    minutes: match[2] && match[3] ? Number(match[2]) * 60 + Number(match[3]) : undefined
  };
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
