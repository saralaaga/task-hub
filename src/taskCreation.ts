import { normalizeRecurrenceRule } from "./recurrence";
import { snapDayStartMinutes } from "./timeGranularity";

export const DEFAULT_TASK_CREATION_FILE_PATH = "Task Hub.md";

export function normalizeTaskCreationFilePath(path: string | undefined): string {
  const trimmed = (path ?? "").trim();
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  const normalized = normalizeVaultPath(withoutLeadingSlash || DEFAULT_TASK_CREATION_FILE_PATH);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export function createTaskLine(text: string, dateKey: string, startMinutes?: number, recurrence?: string | null): string {
  const taskText = text.replace(/\s+/g, " ").trim();
  const timeText = startMinutes === undefined ? "" : ` ⏰ ${formatTaskTime(startMinutes)}`;
  const normalizedRecurrence = normalizeRecurrenceRule(recurrence);
  const recurrenceText = normalizedRecurrence ? ` repeat:: ${normalizedRecurrence}` : "";
  return `- [ ] ${taskText} 🛫 ${dateKey} ⏳ ${dateKey}${timeText}${recurrenceText}`;
}

export function appendTaskToContent(content: string, taskLine: string): string {
  if (!content) return `${taskLine}\n`;
  return `${content}${content.endsWith("\n") ? "" : "\n"}${taskLine}\n`;
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function formatTaskTime(startMinutes: number): string {
  const safeMinutes = snapDayStartMinutes(startMinutes);
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const minutes = String(safeMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
