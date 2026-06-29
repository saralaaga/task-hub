import type { TaskItem } from "../types";
import { nextRecurrenceDate, normalizeRecurrenceRule } from "../recurrence";
import { taskDateKey, taskPlannedDateKey, taskScheduledStartMinutes, taskStartDateForRepair, taskUsesLegacyDueDatePlan } from "../taskDates";

export type CompletionMessages = {
  lineChangedConflict: string;
  lineMismatchConflict: string;
  lineNoLongerOpen: string;
  lineOutsideFile: string;
};

export type RescheduleMessages = CompletionMessages & {
  dateTokenMissing: string;
};

export type CompletionAction = "complete" | "reopen";

export type TaskLineUpdate = {
  title: string;
  date?: string;
  startTime?: string;
  tags: string[];
  recurrence?: string | null;
};

export type CompletionResult =
  | { status: "updated"; content: string; line: number }
  | { status: "already_in_state" }
  | { status: "conflict"; message: string };

const OPEN_TASK_MARKER = /^(\s*)- \[ \]/;
const COMPLETED_TASK_MARKER = /^(\s*)- \[[xX]\]/;
const TASK_PREFIX = /^(\s*- \[[ xX]\]\s+)(.*)$/;
const EMOJI_START = /(?:^|\s)🛫\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const EMOJI_SCHEDULED = /(?:^|\s)⏳\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const EMOJI_DUE = /(?:^|\s)📅\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const INLINE_DUE = /(?:^|\s)due::\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const BARE_DUE = /(?:^|\s)\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const SCHEDULED_TIME = /(?:^|\s)⏰\s*\d{1,2}:\d{2}(?=\s|$)/u;
const RECURRENCE = /(?:^|\s)(?:repeat::|🔁)\s*((?:RRULE:)?[A-Z0-9=;,_-]+)(?=\s|$)/iu;
const COMPLETED_DATE = /(?:^|\s)✅\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;
const SEARCH_WINDOW = 5;
const DEFAULT_COMPLETION_MESSAGES: CompletionMessages = {
  lineChangedConflict: "The task line changed and Task Hub could not safely identify the original task.",
  lineMismatchConflict: "The indexed task line no longer matches the file.",
  lineNoLongerOpen: "The indexed line is no longer an open task.",
  lineOutsideFile: "The indexed task line is outside the file."
};
const DEFAULT_RESCHEDULE_MESSAGES: RescheduleMessages = {
  ...DEFAULT_COMPLETION_MESSAGES,
  dateTokenMissing: "The indexed task line does not contain a supported scheduling date."
};

export function completeTaskInContent(
  content: string,
  task: TaskItem,
  messages: CompletionMessages = DEFAULT_COMPLETION_MESSAGES,
  action: CompletionAction = "complete",
  completedDate = localDateStamp()
): CompletionResult {
  if (isSameTaskInTargetState(lineAt(content, task.line), task.rawLine, action)) {
    return { status: "already_in_state" };
  }

  const lines = content.split(/\r?\n/);
  const direct = tryToggleAtLine(lines, task.line, task, messages, action, completedDate);
  if (direct.status !== "conflict") {
    return withContent(direct, lines);
  }

  const nearby = findNearbyLine(lines, task);
  if (nearby === undefined) {
    return {
      status: "conflict",
      message: messages.lineChangedConflict
    };
  }

  return withContent(tryToggleAtLine(lines, nearby, task, messages, action, completedDate), lines);
}

export function rescheduleTaskInContent(
  content: string,
  task: TaskItem,
  targetDate: string,
  messages: RescheduleMessages = DEFAULT_RESCHEDULE_MESSAGES,
  startMinutes?: number
): CompletionResult {
  if (taskPlannedDateKey(task) === targetDate && normalizedStartMinutes(startMinutes) === taskScheduledStartMinutes(task)) {
    return { status: "already_in_state" };
  }

  const lines = content.split(/\r?\n/);
  const direct = tryRescheduleAtLine(lines, task.line, task, targetDate, messages, startMinutes);
  if (direct.status !== "conflict") {
    return withContent(direct, lines);
  }

  const nearby = findNearbyLine(lines, task);
  if (nearby === undefined) {
    return {
      status: "conflict",
      message: messages.lineChangedConflict
    };
  }

  return withContent(tryRescheduleAtLine(lines, nearby, task, targetDate, messages, startMinutes), lines);
}

export function deleteTaskInContent(
  content: string,
  task: TaskItem,
  messages: CompletionMessages = DEFAULT_COMPLETION_MESSAGES
): CompletionResult {
  const lines = content.split(/\r?\n/);
  const direct = tryDeleteAtLine(lines, task.line, task.rawLine, messages);
  if (direct.status !== "conflict") {
    return withContent(direct, lines);
  }

  const nearby = findNearbyLine(lines, task);
  if (nearby === undefined) {
    return {
      status: "conflict",
      message: messages.lineChangedConflict
    };
  }

  return withContent(tryDeleteAtLine(lines, nearby, task.rawLine, messages), lines);
}

export function updateTaskLineInContent(
  content: string,
  task: TaskItem,
  update: TaskLineUpdate,
  messages: CompletionMessages = DEFAULT_COMPLETION_MESSAGES
): CompletionResult {
  const lines = content.split(/\r?\n/);
  const direct = tryUpdateTaskLineAtLine(lines, task.line, task.rawLine, update, messages);
  if (direct.status !== "conflict") {
    return withContent(direct, lines);
  }

  const nearby = findNearbyLine(lines, task);
  if (nearby === undefined) {
    return {
      status: "conflict",
      message: messages.lineChangedConflict
    };
  }

  return withContent(tryUpdateTaskLineAtLine(lines, nearby, task.rawLine, update, messages), lines);
}

function tryToggleAtLine(
  lines: string[],
  line: number,
  task: TaskItem,
  messages: CompletionMessages,
  action: CompletionAction,
  completedDate: string
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine === task.rawLine) {
    if (hasTargetState(currentLine, action)) {
      return { status: "already_in_state" };
    }

    const marker = action === "complete" ? OPEN_TASK_MARKER : COMPLETED_TASK_MARKER;
    if (!marker.test(currentLine)) {
      return { status: "conflict", message: messages.lineNoLongerOpen };
    }

    const toggledLine = currentLine.replace(marker, action === "complete" ? "$1- [x]" : "$1- [ ]");
    lines[line] = action === "complete" ? withCompletedDate(toggledLine, completedDate) : withoutCompletedDate(toggledLine);
    if (action === "complete") {
      const nextLine = nextRecurringTaskLine(currentLine, task);
      if (nextLine) lines.splice(line + 1, 0, nextLine);
    }
    return { status: "updated", content: "", line };
  }

  return { status: "conflict", message: messages.lineMismatchConflict };
}

function tryRescheduleAtLine(
  lines: string[],
  line: number,
  task: TaskItem,
  targetDate: string,
  messages: RescheduleMessages,
  startMinutes: number | undefined
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine !== task.rawLine) {
    return { status: "conflict", message: messages.lineMismatchConflict };
  }

  const nextLine = buildRescheduledTaskLine(currentLine, task, targetDate, startMinutes);
  if (!nextLine) {
    return { status: "conflict", message: messages.dateTokenMissing };
  }

  lines[line] = nextLine;
  return { status: "updated", content: "", line };
}

function tryDeleteAtLine(
  lines: string[],
  line: number,
  rawLine: string,
  messages: CompletionMessages
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine !== rawLine) {
    return { status: "conflict", message: messages.lineMismatchConflict };
  }

  lines.splice(line, 1);
  return { status: "updated", content: "", line };
}

function tryUpdateTaskLineAtLine(
  lines: string[],
  line: number,
  rawLine: string,
  update: TaskLineUpdate,
  messages: CompletionMessages
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine !== rawLine) {
    return { status: "conflict", message: messages.lineMismatchConflict };
  }

  const match = currentLine.match(TASK_PREFIX);
  if (!match) {
    return { status: "conflict", message: messages.lineNoLongerOpen };
  }

  const nextLine = `${match[1]}${buildUpdatedTaskBody(match[2], update)}`;
  if (nextLine === currentLine) {
    return { status: "already_in_state" };
  }

  lines[line] = nextLine;
  return { status: "updated", content: "", line };
}

function findNearbyLine(lines: string[], task: TaskItem): number | undefined {
  const start = Math.max(0, task.line - SEARCH_WINDOW);
  const end = Math.min(lines.length - 1, task.line + SEARCH_WINDOW);

  for (let index = start; index <= end; index += 1) {
    if (lines[index] === task.rawLine) {
      return index;
    }
  }

  return undefined;
}

function withContent(result: CompletionResult, lines: string[]): CompletionResult {
  if (result.status !== "updated") return result;
  return {
    ...result,
    content: lines.join("\n")
  };
}

function nextRecurringTaskLine(line: string, task: TaskItem): string | undefined {
  const recurrence = normalizeRecurrenceRule(task.recurrence ?? extractRecurrence(line));
  const nextDate = nextRecurrenceDate(taskPlannedDateKey(task), recurrence);
  if (!nextDate) return undefined;
  const opened = withoutCompletedDate(line.replace(COMPLETED_TASK_MARKER, "$1- [ ]").replace(OPEN_TASK_MARKER, "$1- [ ]"));
  const match = opened.match(TASK_PREFIX);
  if (!match) return undefined;
  const metadata = parseTaskBody(match[2]);
  const nextBody = buildTaskBody({
    ...metadata,
    startDate: metadata.startDate || metadata.scheduledDate || !metadata.dueDate ? nextDate : undefined,
    scheduledDate: metadata.hasExplicitScheduledDate ? withScheduledTime(nextDate, scheduledTime(metadata.scheduledDate)) : undefined,
    dueDate: metadata.dueDate ? nextDate : undefined
  });
  return `${match[1]}${nextBody}`;
}

function extractRecurrence(line: string): string | undefined {
  return normalizeRecurrenceRule(line.match(RECURRENCE)?.[1]);
}

function buildUpdatedTaskBody(currentBody: string, update: TaskLineUpdate): string {
  const metadata = parseTaskBody(currentBody);
  const title = update.title.replace(/\s+/g, " ").trim() || metadata.title || cleanTaskBody(currentBody);
  const legacyPlan = !metadata.startDate && !metadata.hasExplicitScheduledDate && Boolean(metadata.dueDate);
  const recurrence = update.recurrence === undefined
    ? metadata.recurrence
    : normalizeRecurrenceRule(update.recurrence);
  return buildTaskBody({
    ...metadata,
    title,
    startDate: update.date ? (metadata.startDate ?? metadata.scheduledDate ?? metadata.dueDate ?? update.date) : undefined,
    scheduledDate: update.date ? withScheduledTime(update.date, update.startTime || undefined) : undefined,
    dueDate: update.date && !legacyPlan ? metadata.dueDate : undefined,
    dueFormat: update.date && !legacyPlan ? metadata.dueFormat : undefined,
    recurrence,
    tags: normalizeTags(update.tags),
    completedDate: metadata.completedDate
  });
}

function cleanTaskBody(body: string): string {
  return body
    .replace(EMOJI_START, " ")
    .replace(EMOJI_SCHEDULED, " ")
    .replace(EMOJI_DUE, " ")
    .replace(INLINE_DUE, " ")
    .replace(COMPLETED_DATE, " ")
    .replace(BARE_DUE, " ")
    .replace(SCHEDULED_TIME, " ")
    .replace(RECURRENCE, " ")
    .replace(TAG, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withCompletedDate(line: string, completedDate: string): string {
  const normalized = withoutCompletedDate(line);
  return `${normalized.trimEnd()} ✅ ${completedDate}`;
}

function withoutCompletedDate(line: string): string {
  return line.replace(COMPLETED_DATE, "").replace(/\s+$/, "");
}

function localDateStamp(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return Array.from(new Set(normalized));
}

function formatTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, Math.round(minutes / 15) * 15));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

type DueFormat = "emoji" | "inline" | "bare" | undefined;

type ParsedTaskBody = {
  title: string;
  dueDate?: string;
  dueFormat?: DueFormat;
  startDate?: string;
  scheduledDate?: string;
  hasExplicitScheduledDate: boolean;
  recurrence?: string;
  completedDate?: string;
  tags: string[];
};

function buildRescheduledTaskLine(line: string, task: TaskItem, targetDate: string, startMinutes: number | undefined): string | undefined {
  const match = line.match(TASK_PREFIX);
  if (!match) return undefined;
  const metadata = parseTaskBody(match[2]);
  return `${match[1]}${buildTaskBody({
    ...metadata,
    startDate: metadata.startDate ?? taskStartDateForRepair(task, targetDate),
    scheduledDate: withScheduledTime(targetDate, startMinutes),
    dueDate: taskUsesLegacyDueDatePlan(task) ? undefined : metadata.dueDate,
    dueFormat: taskUsesLegacyDueDatePlan(task) ? undefined : metadata.dueFormat
  })}`;
}

function parseTaskBody(body: string): ParsedTaskBody {
  const startDate = extractDateToken(body, EMOJI_START);
  const explicitScheduledDate = extractDateToken(body, EMOJI_SCHEDULED);
  const dueDate = extractDueDate(body);
  const scheduleAnchor = explicitScheduledDate ?? dueDate ?? startDate;
  return {
    title: cleanTaskBody(body),
    dueDate,
    dueFormat: extractDueFormat(body),
    startDate,
    scheduledDate: withScheduledTime(scheduleAnchor, scheduledTime(body)),
    hasExplicitScheduledDate: Boolean(explicitScheduledDate),
    recurrence: extractRecurrence(body),
    completedDate: body.match(COMPLETED_DATE)?.[1],
    tags: extractTags(body)
  };
}

function buildTaskBody(body: ParsedTaskBody): string {
  const parts = [body.title.replace(/\s+/g, " ").trim()];
  if (body.startDate) parts.push(`🛫 ${body.startDate}`);
  if (taskDateKey(body.scheduledDate)) parts.push(`⏳ ${taskDateKey(body.scheduledDate)}`);
  if (body.dueDate) parts.push(formatDueDateToken(body.dueDate, body.dueFormat));
  const time = scheduledTime(body.scheduledDate);
  if (time) parts.push(`⏰ ${time}`);
  if (body.recurrence) parts.push(`repeat:: ${body.recurrence}`);
  parts.push(...body.tags);
  const line = parts.filter(Boolean).join(" ");
  return body.completedDate ? `${line} ✅ ${body.completedDate}` : line;
}

function extractDateToken(body: string, pattern: RegExp): string | undefined {
  return body.match(pattern)?.[0].match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function extractDueDate(body: string): string | undefined {
  const withoutStructuredDates = body.replace(EMOJI_START, " ").replace(EMOJI_SCHEDULED, " ").replace(COMPLETED_DATE, " ");
  return withoutStructuredDates.match(EMOJI_DUE)?.[0].match(/\d{4}-\d{2}-\d{2}/)?.[0]
    ?? withoutStructuredDates.match(INLINE_DUE)?.[0].match(/\d{4}-\d{2}-\d{2}/)?.[0]
    ?? withoutStructuredDates.match(BARE_DUE)?.[0].match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function extractDueFormat(body: string): DueFormat {
  if (EMOJI_DUE.test(body)) return "emoji";
  if (INLINE_DUE.test(body)) return "inline";
  if (BARE_DUE.test(body.replace(EMOJI_START, " ").replace(EMOJI_SCHEDULED, " ").replace(COMPLETED_DATE, " "))) return "bare";
  return undefined;
}

function extractTags(body: string): string[] {
  return Array.from(body.matchAll(TAG), (match) => match[2]);
}

function formatDueDateToken(dueDate: string, dueFormat: DueFormat): string {
  if (dueFormat === "inline") return `due:: ${dueDate}`;
  if (dueFormat === "bare") return dueDate;
  return `📅 ${dueDate}`;
}

function scheduledTime(value: string | undefined): string | undefined {
  return value?.match(/T(\d{2}:\d{2})/)?.[1];
}

function withScheduledTime(date: string | undefined, time: string | number | undefined): string | undefined {
  if (!date) return undefined;
  if (typeof time === "number") return `${date}T${formatTime(time)}`;
  return time ? `${date}T${time}` : date;
}

function normalizedStartMinutes(startMinutes: number | undefined): number | undefined {
  if (startMinutes === undefined) return undefined;
  const [hours, minutes] = formatTime(startMinutes).split(":").map(Number);
  return hours * 60 + minutes;
}

function lineAt(content: string, line: number): string | undefined {
  return content.split(/\r?\n/)[line];
}

function hasTargetState(line: string, action: CompletionAction): boolean {
  return action === "complete" ? COMPLETED_TASK_MARKER.test(line) : OPEN_TASK_MARKER.test(line);
}

function isSameTaskInTargetState(line: string | undefined, rawLine: string, action: CompletionAction): boolean {
  if (!line) return false;
  return hasTargetState(line, action) && lineBody(line) === lineBody(rawLine);
}

function lineBody(line: string): string {
  return line.replace(OPEN_TASK_MARKER, "").replace(COMPLETED_TASK_MARKER, "");
}
