export const DEFAULT_TASK_CREATION_FILE_PATH = "Task Hub.md";

export function normalizeTaskCreationFilePath(path: string | undefined): string {
  const trimmed = (path ?? "").trim();
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  const normalized = normalizeVaultPath(withoutLeadingSlash || DEFAULT_TASK_CREATION_FILE_PATH);
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`;
}

export function createTaskLine(text: string, dateKey: string, startMinutes?: number): string {
  const taskText = text.replace(/\s+/g, " ").trim();
  const timeText = startMinutes === undefined ? "" : ` ⏰ ${formatTaskTime(startMinutes)}`;
  return `- [ ] ${taskText} 📅 ${dateKey}${timeText}`;
}

export function appendTaskToContent(content: string, taskLine: string): string {
  if (!content) return `${taskLine}\n`;
  return `${content}${content.endsWith("\n") ? "" : "\n"}${taskLine}\n`;
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function formatTaskTime(startMinutes: number): string {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 45, Math.round(startMinutes / 15) * 15));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const minutes = String(safeMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
