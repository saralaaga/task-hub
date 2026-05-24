import type { TaskItem } from "../types";

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
};

export type CompletionResult =
  | { status: "updated"; content: string; line: number }
  | { status: "already_in_state" }
  | { status: "conflict"; message: string };

const OPEN_TASK_MARKER = /^(\s*)- \[ \]/;
const COMPLETED_TASK_MARKER = /^(\s*)- \[[xX]\]/;
const TASK_PREFIX = /^(\s*- \[[ xX]\]\s+)(.*)$/;
const EMOJI_DUE = /(?:^|\s)📅\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const INLINE_DUE = /(?:^|\s)due::\s*\d{4}-\d{2}-\d{2}(?=\s|$)/u;
const SCHEDULED_TIME = /(?:^|\s)⏰\s*\d{1,2}:\d{2}(?=\s|$)/u;
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
  dateTokenMissing: "The indexed task line does not contain a supported due date."
};

export function completeTaskInContent(
  content: string,
  task: TaskItem,
  messages: CompletionMessages = DEFAULT_COMPLETION_MESSAGES,
  action: CompletionAction = "complete"
): CompletionResult {
  if (isSameTaskInTargetState(lineAt(content, task.line), task.rawLine, action)) {
    return { status: "already_in_state" };
  }

  const lines = content.split(/\r?\n/);
  const direct = tryToggleAtLine(lines, task.line, task.rawLine, messages, action);
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

  return withContent(tryToggleAtLine(lines, nearby, task.rawLine, messages, action), lines);
}

export function rescheduleTaskInContent(
  content: string,
  task: TaskItem,
  targetDate: string,
  messages: RescheduleMessages = DEFAULT_RESCHEDULE_MESSAGES,
  startMinutes?: number
): CompletionResult {
  if (task.dueDate === targetDate && startMinutes === undefined && !taskHasScheduledTime(task)) {
    return { status: "already_in_state" };
  }

  const lines = content.split(/\r?\n/);
  const direct = tryRescheduleAtLine(lines, task.line, task.rawLine, targetDate, messages, startMinutes);
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

  return withContent(tryRescheduleAtLine(lines, nearby, task.rawLine, targetDate, messages, startMinutes), lines);
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
  rawLine: string,
  messages: CompletionMessages,
  action: CompletionAction
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine === rawLine) {
    if (hasTargetState(currentLine, action)) {
      return { status: "already_in_state" };
    }

    const marker = action === "complete" ? OPEN_TASK_MARKER : COMPLETED_TASK_MARKER;
    if (!marker.test(currentLine)) {
      return { status: "conflict", message: messages.lineNoLongerOpen };
    }

    lines[line] = currentLine.replace(marker, action === "complete" ? "$1- [x]" : "$1- [ ]");
    return { status: "updated", content: "", line };
  }

  return { status: "conflict", message: messages.lineMismatchConflict };
}

function tryRescheduleAtLine(
  lines: string[],
  line: number,
  rawLine: string,
  targetDate: string,
  messages: RescheduleMessages,
  startMinutes?: number
): CompletionResult {
  const currentLine = lines[line];
  if (currentLine === undefined) {
    return { status: "conflict", message: messages.lineOutsideFile };
  }

  if (currentLine !== rawLine) {
    return { status: "conflict", message: messages.lineMismatchConflict };
  }

  const nextLine = updateScheduledTime(replaceDueDate(currentLine, targetDate), startMinutes);
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

function replaceDueDate(line: string, targetDate: string): string | undefined {
  if (EMOJI_DUE.test(line)) {
    return line.replace(EMOJI_DUE, (match) => match.replace(/\d{4}-\d{2}-\d{2}/, targetDate));
  }
  if (INLINE_DUE.test(line)) {
    return line.replace(INLINE_DUE, (match) => match.replace(/\d{4}-\d{2}-\d{2}/, targetDate));
  }
  return undefined;
}

function updateScheduledTime(line: string | undefined, startMinutes: number | undefined): string | undefined {
  if (!line) return line;
  if (startMinutes === undefined) return line.replace(SCHEDULED_TIME, "");
  const timeToken = ` ⏰ ${formatTime(startMinutes)}`;
  if (SCHEDULED_TIME.test(line)) {
    return line.replace(SCHEDULED_TIME, timeToken);
  }
  if (EMOJI_DUE.test(line)) {
    return line.replace(EMOJI_DUE, (match) => `${match}${timeToken}`);
  }
  if (INLINE_DUE.test(line)) {
    return line.replace(INLINE_DUE, (match) => `${match}${timeToken}`);
  }
  return line;
}

function taskHasScheduledTime(task: TaskItem): boolean {
  return Boolean(task.scheduledDate) || SCHEDULED_TIME.test(task.rawLine);
}

function buildUpdatedTaskBody(currentBody: string, update: TaskLineUpdate): string {
  const title = update.title.replace(/\s+/g, " ").trim();
  const parts = [title || cleanTaskBody(currentBody)];
  if (update.date) {
    parts.push(INLINE_DUE.test(currentBody) ? `due:: ${update.date}` : `📅 ${update.date}`);
  }
  if (update.startTime) {
    parts.push(`⏰ ${update.startTime}`);
  }
  parts.push(...normalizeTags(update.tags));
  return parts.filter(Boolean).join(" ");
}

function cleanTaskBody(body: string): string {
  return body
    .replace(EMOJI_DUE, " ")
    .replace(INLINE_DUE, " ")
    .replace(SCHEDULED_TIME, " ")
    .replace(TAG, " ")
    .replace(/\s+/g, " ")
    .trim();
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
