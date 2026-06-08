import type { AppleReminderList, DidaProject, TaskHubSettings, TaskSendTarget } from "./types";

export type TaskSendTargetOption = {
  target: TaskSendTarget;
  value: string;
  label: string;
};

export type TaskSendTargetCapabilities = {
  allowAppleReminderCreate?: boolean;
  allowDidaCreate?: boolean;
  appleReminderLists?: AppleReminderList[];
  didaProjects?: DidaProject[];
};

export function serializeTaskSendTarget(target: TaskSendTarget): string {
  if (target.type === "apple-reminders") {
    return `apple-reminders:${target.listId ?? ""}`;
  }
  return `dida:${target.projectId ?? ""}`;
}

export function parseTaskSendTarget(value: string): TaskSendTarget {
  if (value.startsWith("dida:")) {
    const projectId = value.slice("dida:".length);
    return { type: "dida", projectId: projectId || undefined };
  }
  if (value.startsWith("apple-reminders:")) {
    const listId = value.slice("apple-reminders:".length);
    return { type: "apple-reminders", listId: listId || undefined };
  }
  return { type: "apple-reminders" };
}

export function taskSendTargetOptions(
  capabilities: TaskSendTargetCapabilities,
  labels: {
    appleReminders: string;
    appleRemindersInbox: string;
    dida: string;
    didaInbox: string;
  }
): TaskSendTargetOption[] {
  const options: TaskSendTargetOption[] = [];
  if (capabilities.allowAppleReminderCreate) {
    const lists = capabilities.appleReminderLists ?? [];
    if (lists.length === 0) {
      options.push(taskSendTargetOption({ type: "apple-reminders" }, `${labels.appleReminders}: ${labels.appleRemindersInbox}`));
    } else {
      for (const list of lists) {
        options.push(taskSendTargetOption({ type: "apple-reminders", listId: list.id }, `${labels.appleReminders}: ${list.name}`));
      }
    }
  }
  if (capabilities.allowDidaCreate) {
    const projects = capabilities.didaProjects ?? [];
    if (projects.length === 0) {
      options.push(taskSendTargetOption({ type: "dida" }, `${labels.dida}: ${labels.didaInbox}`));
    } else {
      for (const project of projects) {
        options.push(taskSendTargetOption({ type: "dida", projectId: project.id }, `${labels.dida}: ${project.name}`));
      }
    }
  }
  return options;
}

export function normalizeTaskSendDefaultTarget(
  target: unknown,
  settings: Pick<TaskHubSettings, "localApple" | "dida">
): TaskSendTarget | undefined {
  const parsed = isTaskSendTarget(target) ? target : undefined;
  const options = taskSendTargetOptions({
    allowAppleReminderCreate: settings.localApple.enabled && settings.localApple.remindersCreateEnabled,
    allowDidaCreate: settings.dida.enabled && settings.dida.tasksCreateEnabled && Boolean(settings.dida.apiToken.trim()),
    appleReminderLists: settings.localApple.remindersLists,
    didaProjects: settings.dida.projects
  }, {
    appleReminders: "Apple Reminders",
    appleRemindersInbox: "Inbox",
    dida: "Dida",
    didaInbox: "Inbox"
  });
  if (options.length === 0) return parsed;
  if (parsed && options.some((option) => option.value === serializeTaskSendTarget(parsed))) {
    return parsed;
  }
  return options[0].target;
}

export function preferredTaskSendTarget(
  options: TaskSendTargetOption[],
  preferred: TaskSendTarget | undefined
): TaskSendTargetOption | undefined {
  if (options.length === 0) return undefined;
  if (!preferred) return options[0];
  return options.find((option) => option.value === serializeTaskSendTarget(preferred)) ?? options[0];
}

function taskSendTargetOption(target: TaskSendTarget, label: string): TaskSendTargetOption {
  return {
    target,
    value: serializeTaskSendTarget(target),
    label
  };
}

function isTaskSendTarget(value: unknown): value is TaskSendTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<TaskSendTarget>;
  if (target.type === "apple-reminders") return typeof target.listId === "string" || target.listId === undefined;
  if (target.type === "dida") return typeof target.projectId === "string" || target.projectId === undefined;
  return false;
}
