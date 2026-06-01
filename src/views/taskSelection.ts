import type { TaskItem } from "../types";

export type TaskSelectionCapabilities = {
  allowAppleReminderWriteback: boolean;
  allowAppleReminderCreate?: boolean;
  allowAppleCalendarReminderConversion?: boolean;
  allowDidaCreate?: boolean;
  allowDidaWriteback?: boolean;
  allowDidaDelete?: boolean;
  taskNotesEnabled?: boolean;
};

export type TaskBulkActionId =
  | "create-note"
  | "mark-complete"
  | "mark-open"
  | "open-source"
  | "delete"
  | "send-to-apple-reminders"
  | "send-to-apple-calendar"
  | "send-to-dida";

export type TaskBulkAction = {
  id: TaskBulkActionId;
  enabled: boolean;
};

export function resolveTaskBulkActions(tasks: TaskItem[], capabilities: TaskSelectionCapabilities): TaskBulkAction[] {
  if (tasks.length === 0) return [];

  const actions: TaskBulkAction[] = [
    { id: "create-note", enabled: Boolean(capabilities.taskNotesEnabled) },
    { id: "mark-complete", enabled: tasks.every((task) => !task.completed && canToggleTask(task, capabilities)) },
    { id: "mark-open", enabled: tasks.every((task) => task.completed && canToggleTask(task, capabilities)) },
    { id: "open-source", enabled: tasks.length === 1 && canOpenTaskSource(tasks[0]) },
    { id: "delete", enabled: tasks.every((task) => canDeleteTask(task, capabilities)) },
    { id: "send-to-apple-reminders", enabled: tasks.every((task) => canSendTaskToAppleReminders(task, capabilities)) },
    { id: "send-to-apple-calendar", enabled: tasks.every((task) => canSendTaskToAppleCalendar(task, capabilities)) },
    { id: "send-to-dida", enabled: tasks.every((task) => canSendTaskToDida(task, capabilities)) }
  ];

  return actions.filter((action) => action.enabled);
}

export function canToggleTask(task: TaskItem, capabilities: TaskSelectionCapabilities): boolean {
  return task.source === "vault" ||
    (task.source === "apple-reminders" && Boolean(capabilities.allowAppleReminderWriteback && task.externalId)) ||
    (task.source === "dida" && Boolean(capabilities.allowDidaWriteback && task.externalId));
}

export function canDeleteTask(task: TaskItem, capabilities: TaskSelectionCapabilities): boolean {
  if (task.source === "dida") return Boolean(capabilities.allowDidaDelete && task.externalId);
  return canToggleTask(task, capabilities);
}

function canOpenTaskSource(task: TaskItem): boolean {
  return task.source === "vault" || task.source === "apple-reminders" || task.source === "dida";
}

function canSendTaskToAppleReminders(task: TaskItem, capabilities: TaskSelectionCapabilities): boolean {
  return Boolean(capabilities.allowAppleReminderCreate && task.source === "vault");
}

function canSendTaskToAppleCalendar(task: TaskItem, capabilities: TaskSelectionCapabilities): boolean {
  return Boolean(capabilities.allowAppleCalendarReminderConversion && task.source === "apple-reminders" && task.externalId && task.dueDate);
}

function canSendTaskToDida(task: TaskItem, capabilities: TaskSelectionCapabilities): boolean {
  return Boolean(capabilities.allowDidaCreate && task.source === "vault");
}
