import { toLocalDateKey } from "./dateBuckets";
import type { CalendarEvent, TaskItem, WeekStart } from "../types";
import { taskPlannedDateKey, taskScheduledStartMinutes } from "../taskDates";

export type CalendarViewMode = "day" | "week" | "month";

export type CalendarItem = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  startMinutes?: number;
  endMinutes?: number;
  allDay: boolean;
  sourceId: string;
  kind: "task" | "event";
  color?: string;
  isMultiDay?: boolean;
  isMultiDayStart?: boolean;
  isMultiDayEnd?: boolean;
  createdSortKey?: string;
  task?: TaskItem;
  event?: CalendarEvent;
};

export type BuildCalendarItemsInput = {
  tasks: TaskItem[];
  events: CalendarEvent[];
  visibleSourceIds: Set<string>;
  includeCompletedTasks: boolean;
  sourceColors?: Record<string, string>;
  eventColors?: Record<string, string>;
  taskColors?: Record<string, string>;
  taskDurationOverrides?: Record<string, number>;
};

export type CalendarRange = {
  start: string;
  end: string;
  days: string[];
};

const WEEK_START_DAY_INDEX: Record<WeekStart, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

export function buildCalendarItems(input: BuildCalendarItemsInput): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const task of input.tasks) {
    const sourceId = task.source;
    const plannedDate = taskPlannedDateKey(task);
    if (!input.visibleSourceIds.has(sourceId)) continue;
    if (!plannedDate) continue;
    if (task.completed && !input.includeCompletedTasks) continue;
    const taskStartMinutes = taskScheduledStartMinutes(task);
    items.push({
      id: `task:${task.id}`,
      title: task.text,
      date: plannedDate,
      startMinutes: taskStartMinutes,
      endMinutes: undefined,
      allDay: taskStartMinutes === undefined,
      sourceId,
      kind: "task",
      color: taskColor(task, input.taskColors, input.sourceColors),
      createdSortKey: task.createdDate ?? task.startDate ?? "",
      task
    });
  }

  for (const event of input.events) {
    const layerId = calendarEventLayerId(event);
    if (!input.visibleSourceIds.has(layerId)) continue;
    const timing = eventTiming(event);
    const dates = eventDates(timing.date, timing.endDate);
    for (const date of dates) {
      const isStart = date === timing.date;
      const isEnd = date === timing.endDate || dates.length === 1;
      items.push({
        id: dates.length === 1 ? `event:${layerId}:${event.id}` : `event:${layerId}:${event.id}:${date}`,
        title: event.title,
        date,
        endDate: timing.endDate,
        startMinutes: event.allDay || !isStart ? undefined : timing.startMinutes,
        endMinutes: event.allDay || !isEnd ? undefined : timing.endMinutes,
        allDay: event.allDay || timing.startMinutes === undefined || dates.length > 1,
        sourceId: layerId,
        kind: "event",
        color: eventColor(event, input.eventColors, input.sourceColors),
        isMultiDay: dates.length > 1,
        isMultiDayStart: dates.length > 1 && isStart,
        isMultiDayEnd: dates.length > 1 && isEnd,
        event
      });
    }
  }

  return items.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      Number(right.allDay) - Number(left.allDay) ||
      (left.startMinutes ?? -1) - (right.startMinutes ?? -1) ||
      calendarCompletionRank(left) - calendarCompletionRank(right) ||
      taskCreatedSortRank(left, right) ||
      left.title.localeCompare(right.title)
  );
}

function taskColor(task: TaskItem, taskColors?: Record<string, string>, sourceColors?: Record<string, string>): string | undefined {
  return (task.externalListId ? taskColors?.[task.externalListId] : undefined) ?? sourceColors?.[task.source];
}

function taskCreatedSortRank(left: CalendarItem, right: CalendarItem): number {
  if (left.kind !== "task" || right.kind !== "task") return 0;
  if (left.startMinutes !== right.startMinutes) return 0;
  return (right.createdSortKey ?? "").localeCompare(left.createdSortKey ?? "");
}

function eventColor(event: CalendarEvent, eventColors?: Record<string, string>, sourceColors?: Record<string, string>): string | undefined {
  const layerId = calendarEventLayerId(event);
  return (event.calendarId ? eventColors?.[event.calendarId] : undefined) ?? event.calendarColor ?? sourceColors?.[layerId] ?? sourceColors?.[event.sourceId];
}

export function calendarEventLayerId(event: CalendarEvent): string {
  return event.sourceId === "apple-calendar" && event.calendarId ? `apple-calendar:${event.calendarId}` : event.sourceId;
}

function calendarCompletionRank(item: CalendarItem): number {
  return item.kind === "task" && item.task?.completed ? 1 : 0;
}

function eventTiming(event: CalendarEvent): Pick<CalendarItem, "date" | "endDate" | "startMinutes" | "endMinutes"> {
  const start = parseCalendarDateTime(event.start);
  const end = parseCalendarDateTime(event.end);
  const date = start?.date ?? event.start.slice(0, 10);
  return {
    date,
    endDate: normalizedEventEndDate(event, date, end, event.end),
    startMinutes: event.allDay ? undefined : start?.minutes,
    endMinutes: event.allDay ? undefined : end?.minutes
  };
}

function normalizedEventEndDate(
  event: CalendarEvent,
  startDate: string,
  end: { date: string; minutes?: number } | undefined,
  rawEnd: string | undefined
): string | undefined {
  if (!end) return undefined;
  if (!event.allDay) return end.date;

  const exclusiveEnd = parseDateKey(end.date);
  if (!exclusiveEnd) return end.date;
  exclusiveEnd.setDate(exclusiveEnd.getDate() - 1);
  const inclusiveEnd = toLocalDateKey(exclusiveEnd);
  return inclusiveEnd < startDate ? startDate : inclusiveEnd;
}

function eventDates(startDate: string, endDate: string | undefined): string[] {
  if (!endDate || endDate <= startDate) return [startDate];

  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end || end < start) return [startDate];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parseDateKey(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseCalendarDateTime(value: string | undefined): { date: string; minutes?: number } | undefined {
  if (!value) return undefined;

  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasExplicitZone) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return {
        date: toLocalDateKey(date),
        minutes: date.getHours() * 60 + date.getMinutes()
      };
    }
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return undefined;
  return {
    date: match[1],
    minutes: match[2] && match[3] ? Number(match[2]) * 60 + Number(match[3]) : undefined
  };
}

export function getCalendarRange(mode: CalendarViewMode, focusDate: Date, weekStart: WeekStart): CalendarRange {
  if (mode === "day") {
    const day = toLocalDateKey(focusDate);
    return { start: day, end: day, days: [day] };
  }

  if (mode === "week") {
    const start = startOfWeek(focusDate, weekStart);
    const days = enumerateDays(start, 7);
    return { start: days[0], end: days[days.length - 1], days };
  }

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const monthEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
  const days = enumerateDateRange(monthStart, monthEnd);
  return { start: days[0], end: days[days.length - 1], days };
}

function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const desiredStart = WEEK_START_DAY_INDEX[weekStart];
  const diff = (start.getDay() - desiredStart + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

function enumerateDateRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function enumerateDays(start: Date, count: number): string[] {
  const days: string[] = [];
  const cursor = new Date(start);
  for (let index = 0; index < count; index += 1) {
    days.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
