import type { Translator } from "../i18n";
import type { CalendarEvent, TaskItem } from "../types";
import type { TaskBulkActionId } from "./taskSelection";

type MenuItemLike = {
  setTitle(title: string): MenuItemLike;
  setIcon(icon: string): MenuItemLike;
  setDisabled(disabled: boolean): MenuItemLike;
  onClick(click: () => void): MenuItemLike;
};

export function addSourceIndicatorMenuItem(
  menu: { addItem(build: (item: MenuItemLike) => void): void },
  label: string,
  icon = "info"
): void {
  menu.addItem((item) => {
    item
      .setTitle(label)
      .setIcon(icon)
      .setDisabled(true)
      .onClick(() => undefined);
  });
}

export function sourceIndicatorLabelForTask(task: TaskItem, t: Translator): string {
  if (task.source === "vault") return t("sourceVaultTask");
  if (task.source === "apple-reminders") return t("sourceAppleReminders");
  return t("sourceDida");
}

export function sourceIndicatorLabelForEvent(event: CalendarEvent, t: Translator): string {
  if (event.sourceId === "apple-calendar") return t("sourceAppleCalendar");
  return t("calendar");
}

export function deleteLabelForTask(task: TaskItem, t: Translator): string {
  if (task.source === "dida") return t("deleteFromDida");
  if (task.source === "apple-reminders") return t("deleteFromAppleReminders");
  return t("deleteCalendarItem");
}

export function deleteLabelForEvent(event: CalendarEvent, t: Translator): string {
  if (event.sourceId === "apple-calendar") return t("deleteFromAppleCalendar");
  return t("deleteCalendarItem");
}

export function deleteLabelForTaskBulkAction(action: TaskBulkActionId, tasks: TaskItem[], t: Translator): string {
  if (action !== "delete") return "";
  if (tasks.length === 0) return t("deleteCalendarItem");
  const firstSource = tasks[0].source;
  if (!tasks.every((task) => task.source === firstSource)) return t("deleteCalendarItem");
  return deleteLabelForTask(tasks[0], t);
}
