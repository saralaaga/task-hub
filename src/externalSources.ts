import { Platform } from "obsidian";
import type { TaskItem } from "./types";

export const APPLE_REMINDERS_URL = "x-apple-reminderkit://";

export type ExternalOpenResult = "opened" | "unsupported" | "no-source";

export function openExternalTaskSource(task: TaskItem, openUrl: (url: string) => void): ExternalOpenResult {
  if (task.externalUrl) {
    openUrl(task.externalUrl);
    return "opened";
  }

  if (task.source === "apple-reminders") {
    if (!Platform.isMacOS) {
      return "unsupported";
    }
    openUrl(APPLE_REMINDERS_URL);
    return "opened";
  }

  if (task.source === "dida") {
    openUrl("https://dida365.com/webapp");
    return "opened";
  }

  return "no-source";
}
