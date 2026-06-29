import type { CalendarSource, DidaProject, TaskItem } from "../types";
import type { DidaProjectRecord, DidaTaskPayload, DidaTaskRecord } from "./didaClient";
import { didaTagsForTaskHub, normalizeDidaTags } from "./didaTags";

export const DIDA_SOURCE_ID = "dida";
export const DIDA_SOURCE_NAME = "Dida";
export const DIDA_INBOX_PROJECT_NAME = "收集箱";
export const DEFAULT_DIDA_API_BASE = "https://api.dida365.com";
export const TICKTICK_API_BASE = "https://api.ticktick.com";

export function didaTaskToTaskItem(task: DidaTaskRecord, project: DidaProject, index: number): TaskItem {
  const dueDate = toLocalDateKey(task.dueDate);
  const startDate = toLocalDateKey(task.startDate);
  const scheduledDate = toScheduledDate(task.dueDate, task.isAllDay);
  const tags = task.tags ? didaTagsForTaskHub(task.tags) : extractHashtags(task.title);
  return {
    id: `${DIDA_SOURCE_ID}:${task.id}`,
    stableId: `${DIDA_SOURCE_ID}:${task.id}`,
    filePath: `${DIDA_SOURCE_NAME}/${project.name}`,
    line: index,
    rawLine: task.title,
    text: task.title,
    completed: task.status === 2 || Boolean(task.completedTime),
    tags,
    dueDate,
    startDate,
    contextPreview: task.content ?? task.desc,
    source: DIDA_SOURCE_ID,
    externalId: task.id,
    externalSourceName: project.name,
    externalUrl: undefined,
    scheduledDate,
    priority: task.priority === undefined ? undefined : String(task.priority),
    recurrence: task.repeatFlag,
    completedDate: toLocalDateKey(task.completedTime),
    externalListId: task.projectId || project.id
  };
}

export function taskItemToDidaPayload(input: {
  title: string;
  projectId?: string;
  notes?: string;
  date?: string | null;
  startDate?: string | null;
  startMinutes?: number;
  tags?: string[];
  reminderOffsetMinutes?: number;
  priority?: number;
  repeatFlag?: string;
}): DidaTaskPayload {
  const tags = normalizeDidaTags(input.tags ?? []);
  const title = cleanTitle(input.title);
  const payload: DidaTaskPayload = {
    title,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.notes !== undefined ? { content: input.notes, desc: input.notes } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.repeatFlag !== undefined ? { repeatFlag: input.repeatFlag } : {}),
    ...(tags.length > 0 ? { tags } : {})
  };

  if (input.date) {
    const hasTime = input.startMinutes !== undefined;
    payload.isAllDay = !hasTime;
    payload.dueDate = hasTime ? localDateTimeWithOffset(input.date, input.startMinutes as number) : `${input.date}T00:00:00+0800`;
    payload.timeZone = "Asia/Shanghai";
    if (input.reminderOffsetMinutes !== undefined) {
      payload.reminders = [reminderTrigger(input.reminderOffsetMinutes)];
    }
  }

  if (input.startDate) {
    payload.startDate = `${input.startDate}T00:00:00+0800`;
    payload.timeZone = payload.timeZone ?? "Asia/Shanghai";
  }

  return payload;
}

export function didaSource(color = "#3b82f6", status: CalendarSource["status"] = { state: "never" }): CalendarSource {
  return {
    id: DIDA_SOURCE_ID,
    name: DIDA_SOURCE_NAME,
    type: DIDA_SOURCE_ID,
    url: "https://dida365.com",
    color,
    enabled: true,
    refreshIntervalMinutes: 0,
    status,
    cachedEvents: []
  };
}

export function didaProjectsFromRecords(records: DidaProjectRecord[]): DidaProject[] {
  return records.map((record) => ({ id: record.id, name: record.name }));
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/gu, " ").trim();
}

function extractHashtags(title: string): string[] {
  return title.match(/#[\p{L}\p{N}_/-]+/gu) ?? [];
}

function toLocalDateKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return dateOnly[1];
  const floatingDateTime = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (floatingDateTime && !hasExplicitZone(value)) return floatingDateTime[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return formatLocalDateKey(date);
}

function toLocalDateTime(value: string | undefined): string | undefined {
  if (!value || !/T\d{2}:\d{2}/.test(value)) return undefined;
  const floating = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?/);
  if (floating && !hasExplicitZone(value)) return floating[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return floating?.[1];
  return `${formatLocalDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toScheduledDate(value: string | undefined, isAllDay: boolean | undefined): string | undefined {
  if (!value) return undefined;
  return isAllDay ? toLocalDateKey(value) : toLocalDateTime(value) ?? toLocalDateKey(value);
}

function hasExplicitZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDateTimeWithOffset(date: string, startMinutes: number): string {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(startMinutes)));
  const hour = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const minute = String(safeMinutes % 60).padStart(2, "0");
  return `${date}T${hour}:${minute}:00+0800`;
}

function reminderTrigger(offsetMinutes: number): string {
  if (offsetMinutes <= 0) return "TRIGGER:PT0S";
  return `TRIGGER:-PT${Math.round(offsetMinutes)}M`;
}
