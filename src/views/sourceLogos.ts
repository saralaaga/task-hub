import type { TaskItem } from "../types";
import type { CalendarItem } from "../calendar/calendarModel";

export type SourceLogoKind = "apple" | "dida" | "obsidian";

const APPLE_LOGO_PATH =
  "M16.2 2.2c.1 1.2-.4 2.4-1.2 3.3-.8.9-2.1 1.5-3.2 1.4-.1-1.1.4-2.3 1.1-3.1.9-1 2.3-1.6 3.3-1.6ZM20 17.4c-.4.9-.6 1.3-1.1 2.1-.7 1.1-1.8 2.5-3.1 2.5-1.1 0-1.4-.7-2.9-.7s-1.8.7-2.9.7c-1.3 0-2.3-1.3-3.1-2.4-2.1-3.2-2.4-7-.9-9 1-1.3 2.5-2.1 3.9-2.1 1.4 0 2.3.7 3.1.7.8 0 2-.8 3.4-.7 1.2 0 2.4.5 3.3 1.7-2.9 1.6-2.4 5.6.3 7.2Z";

const DIDA_LOGO_PATH =
  "M12 2.5c2.8 0 5.5 1.1 7.4 3.1 1.9 2 3 4.6 2.9 7.4 0 2.8-1.1 5.5-3.1 7.4-2 1.9-4.6 3-7.4 2.9-2.8 0-5.5-1.1-7.4-3.1-1.9-2-3-4.6-2.9-7.4 0-2.8 1.1-5.5 3.1-7.4 2-1.9 4.6-3 7.4-2.9Zm4.8 5.9a1 1 0 0 0-1.4 0l-4.6 4.6-2.2-2.2a1 1 0 1 0-1.4 1.4l2.9 2.9a1 1 0 0 0 1.4 0l5.3-5.3a1 1 0 0 0 0-1.4Z";

const OBSIDIAN_LOGO_PATH =
  "M25.894 56.42l1.514-.445c3.44-.98 7.89-1.977 12.879-1.354A18 18 0 0 1 50.72 59.3c3.598 2.878 6.477 7.196 9.355 14.392a25.2 25.2 0 0 0-2.878 9.715c-.72 4.318-4.678 7.556-8.996 6.117a85.6 85.6 0 0 0-26.626-5.037h-.72c6.477-10.075 7.197-19.79 5.038-28.066ZM10.782 37.35v-.36l1.022 1.18c2.548 2.98 6.13 7.546 8.333 13.213a31.3 31.3 0 0 1-2.878 31.304L1.787 66.855c-1.8-1.8-2.16-4.318-1.44-6.837L10.422 38.43zM45.684 6.766l12.233 15.472c1.08 1.08 1.08 2.16 1.08 3.598c.337 3.71.358 10.584 2.435 15.58l.443.972a64.8 64.8 0 0 0 7.197 12.593c.72 1.08.72 2.159.72 3.598l-7.197 10.795h-.36c-2.519-5.757-5.397-10.075-8.995-12.954c-4.318-3.598-8.636-5.037-12.594-5.757h-1.439c-3.238-6.836-3.238-12.233-3.238-16.91a39.6 39.6 0 0 1 4.318-13.674l2.878-5.757l2.519-5.397zM33.45 1.37c1.8-1.08 3.598-1.8 5.757-1.08c1.44 1.44 2.159 2.52 2.519 3.959v3.598a118 118 0 0 1-3.238 8.275l-1.44 2.52a35.98 35.98 0 0 0-1.799 31.663a43.2 43.2 0 0 0-10.074 2.158h-.36a52.5 52.5 0 0 0-13.313-19.79l1.439-10.794C13.3 20.44 14.02 19 15.1 18.28z";

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

function sourceLogoViewBox(kind: SourceLogoKind): string {
  return kind === "obsidian" ? "0 0 70 90" : "0 0 24 24";
}

export function renderSourceLogo(container: HTMLElement, className: string, kind: SourceLogoKind): void {
  const logo = container.createSpan({ cls: `${className} is-${kind}` });
  logo.setAttr("aria-hidden", "true");
  logo.createSvg("svg", { attr: { viewBox: sourceLogoViewBox(kind), focusable: "false" } })
    .createSvg("path", { attr: { d: sourceLogoPath(kind) } });
}
