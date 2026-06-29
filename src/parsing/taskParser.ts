import type { TaskItem } from "../types";
import { normalizeRecurrenceRule } from "../recurrence";

type ParseInput = {
  filePath: string;
  content: string;
};

const TASK_LINE = /^(\s*)- \[([ xX])\]\s+(.*)$/;
const TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;
const EMOJI_START = /(?:^|\s)🛫\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const EMOJI_SCHEDULED = /(?:^|\s)⏳\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const EMOJI_DUE = /(?:^|\s)📅\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const INLINE_DUE = /(?:^|\s)due::\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const BARE_DUE = /(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const EMOJI_TIME = /(?:^|\s)⏰\s*([01]\d|2[0-3]):([0-5]\d)(?=\s|$)/u;
const RECURRENCE = /(?:^|\s)(?:repeat::|🔁)\s*((?:RRULE:)?[A-Z0-9=;,_-]+)(?=\s|$)/iu;
const COMPLETED_DATE = /(?:^|\s)✅\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/u;
const HEADING = /^(#{1,6})\s+(.+)$/;

export function parseTasksFromMarkdown(input: ParseInput): TaskItem[] {
  const lines = input.content.split(/\r?\n/);
  const tasks: TaskItem[] = [];
  const taskStack: TaskItem[] = [];
  let currentHeading: string | undefined;

  lines.forEach((line, index) => {
    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      return;
    }

    const match = line.match(TASK_LINE);
    if (!match) return;

    const rawBody = match[3].trim();
    const indent = indentationLevel(match[1]);
    taskStack.length = indent;
    const parentId = findParentId(taskStack, indent);
    const tags = extractTags(rawBody);
    const startDate = extractStartDate(rawBody);
    const dueDate = extractDueDate(rawBody);
    const scheduledDate = extractScheduledDate(rawBody, extractScheduledDateKey(rawBody) ?? dueDate ?? startDate);
    const recurrence = extractRecurrence(rawBody);
    const completedDate = extractCompletedDate(rawBody);
    const text = cleanTaskText(rawBody).trim();
    const id = createTaskId(input.filePath, index, line);
    const task: TaskItem = {
      id,
      stableId: id,
      filePath: input.filePath,
      line: index,
      rawLine: line,
      text,
      completed: match[2].toLowerCase() === "x",
      tags,
      indent,
      parentId,
      dueDate,
      scheduledDate,
      startDate,
      recurrence,
      completedDate,
      heading: currentHeading,
      contextPreview: buildContextPreview(lines, index),
      source: "vault"
    };

    tasks.push(task);
    taskStack[indent] = task;
  });

  return tasks;
}

function indentationLevel(indent: string): number {
  const columns = Array.from(indent).reduce((total, character) => total + (character === "\t" ? 4 : 1), 0);
  return Math.floor(columns / 2);
}

function findParentId(taskStack: TaskItem[], indent: number): string | undefined {
  for (let parentIndent = indent - 1; parentIndent >= 0; parentIndent -= 1) {
    const parent = taskStack[parentIndent];
    if (parent) return parent.id;
  }
  return undefined;
}

function extractTags(text: string): string[] {
  return Array.from(text.matchAll(TAG), (match) => match[2]);
}

function extractDueDate(text: string): string | undefined {
  const withoutScheduleDates = text
    .replace(COMPLETED_DATE, " ")
    .replace(EMOJI_START, " ")
    .replace(EMOJI_SCHEDULED, " ");
  return withoutScheduleDates.match(EMOJI_DUE)?.[1] ?? withoutScheduleDates.match(INLINE_DUE)?.[1] ?? withoutScheduleDates.match(BARE_DUE)?.[1];
}

function extractStartDate(text: string): string | undefined {
  return text.match(EMOJI_START)?.[1];
}

function extractScheduledDateKey(text: string): string | undefined {
  return text.match(EMOJI_SCHEDULED)?.[1];
}

function extractScheduledDate(text: string, anchorDate: string | undefined): string | undefined {
  if (!anchorDate) return undefined;
  const match = text.match(EMOJI_TIME);
  if (!match) return anchorDate;
  return `${anchorDate}T${match[1]}:${match[2]}`;
}

function extractRecurrence(text: string): string | undefined {
  return normalizeRecurrenceRule(text.match(RECURRENCE)?.[1]);
}

function extractCompletedDate(text: string): string | undefined {
  return text.match(COMPLETED_DATE)?.[1];
}

function cleanTaskText(text: string): string {
  return text
    .replace(EMOJI_START, " ")
    .replace(EMOJI_SCHEDULED, " ")
    .replace(EMOJI_DUE, " ")
    .replace(INLINE_DUE, " ")
    .replace(COMPLETED_DATE, " ")
    .replace(BARE_DUE, " ")
    .replace(EMOJI_TIME, " ")
    .replace(RECURRENCE, " ")
    .replace(TAG, " ")
    .replace(/\s+/g, " ");
}

function buildContextPreview(lines: string[], taskLine: number): string {
  const start = Math.max(0, taskLine - 1);
  const end = Math.min(lines.length, taskLine + 2);
  return lines.slice(start, end).join("\n");
}

function createTaskId(filePath: string, line: number, rawLine: string): string {
  return `${filePath}:${line}:${hash(rawLine)}`;
}

function hash(value: string): string {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33) ^ value.charCodeAt(index);
  }
  return (result >>> 0).toString(36);
}
