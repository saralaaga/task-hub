import type { TaskItem } from "./types";

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
const TIME_TOKEN = /T(\d{2}):(\d{2})/;
const EXPLICIT_START_TOKEN = /(?:^|\s)🛫\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const EXPLICIT_SCHEDULED_TOKEN = /(?:^|\s)⏳\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;

type TaskDateFields = Pick<TaskItem, "dueDate" | "scheduledDate" | "startDate" | "rawLine">;
type TaskWindowFields = Pick<TaskItem, "completed" | "completedDate" | "dueDate" | "scheduledDate" | "startDate" | "rawLine">;

export function taskDateKey(value: string | undefined): string | undefined {
  return value?.match(DATE_PREFIX)?.[1];
}

export function taskScheduledDateKey(task: Pick<TaskItem, "scheduledDate">): string | undefined {
  return taskDateKey(task.scheduledDate);
}

export function taskStartDateKey(task: Pick<TaskItem, "startDate">): string | undefined {
  return taskDateKey(task.startDate);
}

export function taskLegacyDueDateKey(task: Pick<TaskItem, "dueDate">): string | undefined {
  return taskDateKey(task.dueDate);
}

export function taskPlannedDateKey(task: TaskDateFields): string | undefined {
  return taskScheduledDateKey(task) ?? taskStartDateKey(task) ?? taskLegacyDueDateKey(task);
}

export function taskUsesLegacyDueDatePlan(task: TaskDateFields): boolean {
  const rawLine = task.rawLine ?? "";
  return !EXPLICIT_START_TOKEN.test(rawLine) && !EXPLICIT_SCHEDULED_TOKEN.test(rawLine) && Boolean(taskLegacyDueDateKey(task));
}

export function taskStartDateForRepair(task: TaskDateFields, fallbackDate: string): string {
  return taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? fallbackDate;
}

export function taskScheduledStartMinutes(task: Pick<TaskItem, "scheduledDate">): number | undefined {
  const match = task.scheduledDate?.match(TIME_TOKEN);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function taskCompletedDateKey(task: Pick<TaskItem, "completedDate">): string | undefined {
  return taskDateKey(task.completedDate);
}

export function taskWindowDateKey(task: TaskWindowFields): string | undefined {
  if (task.completed) {
    return taskCompletedDateKey(task) ?? taskPlannedDateKey(task);
  }
  return taskPlannedDateKey(task);
}

export function isDateKeyWithinWindow(dateKey: string, now: Date, lookbackDays: number, lookaheadDays: number): boolean {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - lookbackDays);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + lookaheadDays);
  const candidate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(candidate.getTime())) return true;
  return candidate >= start && candidate <= end;
}
