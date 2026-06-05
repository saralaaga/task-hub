import type { TaskItem } from "../types";
import type { CalendarItem } from "../calendar/calendarModel";

export type SourceLogoKind = "apple" | "dida" | "obsidian";

const APPLE_LOGO_PATH =
  "M16.2 2.2c.1 1.2-.4 2.4-1.2 3.3-.8.9-2.1 1.5-3.2 1.4-.1-1.1.4-2.3 1.1-3.1.9-1 2.3-1.6 3.3-1.6ZM20 17.4c-.4.9-.6 1.3-1.1 2.1-.7 1.1-1.8 2.5-3.1 2.5-1.1 0-1.4-.7-2.9-.7s-1.8.7-2.9.7c-1.3 0-2.3-1.3-3.1-2.4-2.1-3.2-2.4-7-.9-9 1-1.3 2.5-2.1 3.9-2.1 1.4 0 2.3.7 3.1.7.8 0 2-.8 3.4-.7 1.2 0 2.4.5 3.3 1.7-2.9 1.6-2.4 5.6.3 7.2Z";

const DIDA_LOGO_PATH =
  "M12 2.5c2.8 0 5.5 1.1 7.4 3.1 1.9 2 3 4.6 2.9 7.4 0 2.8-1.1 5.5-3.1 7.4-2 1.9-4.6 3-7.4 2.9-2.8 0-5.5-1.1-7.4-3.1-1.9-2-3-4.6-2.9-7.4 0-2.8 1.1-5.5 3.1-7.4 2-1.9 4.6-3 7.4-2.9Zm4.8 5.9a1 1 0 0 0-1.4 0l-4.6 4.6-2.2-2.2a1 1 0 1 0-1.4 1.4l2.9 2.9a1 1 0 0 0 1.4 0l5.3-5.3a1 1 0 0 0 0-1.4Z";

const OBSIDIAN_LOGO_PATH =
  "M12.2 1.8 6.7 6.4 5.9 12l3.6 8.2 3.4 2 5.5-4.6.8-5.6-3.6-8.2-3.4-2Zm-.1 2.8 2.2 1.3 2.6 6-2.2 3.8-1.9-2.7-2.2 3.4-1-4.5 2.5-7.3Zm-1.5 13.8 2.3-3.5 2 2.9-2 1.7-2.3-1.1Z";

export function sourceLogoKindForTask(task: TaskItem | undefined): SourceLogoKind | undefined {
  if (!task) return undefined;
  if (task.source === "apple-reminders") return "apple";
  if (task.source === "dida") return "dida";
  return "obsidian";
}

export function sourceLogoKindForCalendarItem(item: CalendarItem): SourceLogoKind | undefined {
  if (item.task) return sourceLogoKindForTask(item.task);
  if (item.event?.sourceId === "apple-calendar") return "apple";
  return undefined;
}

export function sourceLogoPath(kind: SourceLogoKind): string {
  if (kind === "apple") return APPLE_LOGO_PATH;
  if (kind === "dida") return DIDA_LOGO_PATH;
  return OBSIDIAN_LOGO_PATH;
}

export function renderSourceLogo(container: HTMLElement, className: string, kind: SourceLogoKind): void {
  const logo = container.createSpan({ cls: `${className} is-${kind}` });
  logo.setAttr("aria-hidden", "true");
  logo.createSvg("svg", { attr: { viewBox: "0 0 24 24", focusable: "false" } })
    .createSvg("path", { attr: { d: sourceLogoPath(kind) } });
}
