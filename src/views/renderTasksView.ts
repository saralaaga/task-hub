import { type DateBucket } from "../calendar/dateBuckets";
import { getTaskBucket, type TaskFilterState } from "../filtering/filters";
import type { Translator } from "../i18n";
import type { AppleReminderList, TaskItem } from "../types";

export type TaskRowHandlers = {
  onComplete: (task: TaskItem) => void;
  onJump: (task: TaskItem) => void;
  onSendToAppleReminders: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  onTagSelect: (tag: string) => void;
  onSourceSelect: (source: "all" | "vault" | "apple-reminders") => void;
  onAppleReminderListChange: (task: TaskItem, listId: string) => void;
};

export type TaskRenderOptions = {
  allowAppleReminderCreate?: boolean;
  allowAppleReminderWriteback: boolean;
  selectedTaskId?: string;
  sourceColors?: Partial<Record<TaskItem["source"], string>>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  taskListScrollTop?: number;
  exitingTaskIds?: ReadonlySet<string>;
};

const BUCKETS = ["overdue", "today", "tomorrow", "thisWeek", "future", "noDate", "otherCompleted"] as const;

export function renderTasksView(
  container: HTMLElement,
  tasks: TaskItem[],
  allTasks: TaskItem[],
  filters: TaskFilterState,
  handlers: TaskRowHandlers,
  now: Date,
  t: Translator,
  options: TaskRenderOptions = { allowAppleReminderWriteback: false }
): void {
  container.empty();

  const hasActiveFilter =
    filters.status !== "open" ||
    Boolean(filters.dateBucket) ||
    filters.tags.length > 0 ||
    Boolean(filters.sourceQuery) ||
    Boolean(filters.textQuery);

  if (tasks.length === 0 && !hasActiveFilter) {
    container.createDiv({
      cls: "task-hub-empty",
      text: t("noOpenTasks")
    });
    return;
  }

  const sortedTasks = sortTasksForTaskList(tasks);
  let selectedTask = sortedTasks.find((task) => task.id === options.selectedTaskId) ?? sortedTasks.find((task) => !task.completed) ?? sortedTasks[0];
  const workbench = container.createDiv({ cls: "task-hub-task-workbench" });
  const list = workbench.createDiv({ cls: "task-hub-task-list-pane" });

  if (sortedTasks.length === 0) {
    list.createDiv({ cls: "task-hub-empty", text: t("noMatchingTasks") });
    restoreTaskListScroll(list, options);
    return;
  }

  const groups = groupSortedTasksByDateBucket(sortedTasks, now);
  const rowsByTaskId = new Map<string, HTMLElement>();
  let detailsHost: HTMLElement | undefined;
  const selectTask = (task: TaskItem) => {
    selectedTask = task;
    for (const [taskId, row] of rowsByTaskId) {
      row.toggleClass("is-selected", taskId === task.id);
    }
    if (detailsHost) {
      renderTaskDetails(detailsHost, selectedTask, handlers, options, t);
    }
    handlers.onSelect(task);
  };

  for (const bucket of BUCKETS) {
    const bucketTasks = groups[bucket];
    if (bucketTasks.length === 0) continue;

    const section = list.createDiv({ cls: "task-hub-task-section" });
    section.createEl("h3", { text: `${t(bucket)} (${bucketTasks.length})` });
    const cards = section.createDiv({ cls: "task-hub-task-list-flow" });

    for (const task of bucketTasks) {
      const row = renderTaskRow(cards, task, handlers, options, task.id === selectedTask?.id, selectTask);
      rowsByTaskId.set(task.id, row);
    }
  }
  restoreTaskListScroll(list, options);
  detailsHost = workbench.createDiv({ cls: "task-hub-task-details-host" });
  renderTaskDetails(detailsHost, selectedTask, handlers, options, t);
}

function restoreTaskListScroll(list: HTMLElement, options: TaskRenderOptions): void {
  if (options.taskListScrollTop !== undefined) {
    list.scrollTop = options.taskListScrollTop;
  }
}

function renderTaskRow(
  container: HTMLElement,
  task: TaskItem,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  selected: boolean,
  onSelect: (task: TaskItem) => void
): HTMLElement {
  const classes = [
    "task-hub-task-row",
    selected ? "is-selected" : "",
    task.completed ? "is-completed" : "",
    options.exitingTaskIds?.has(task.id) ? "is-exiting" : ""
  ].filter(Boolean).join(" ");
  const row = container.createDiv({ cls: classes });
  const color = taskDisplayColor(task, options);
  if (color) row.style.setProperty("--task-hub-source-color", color);
  const checkbox = row.createEl("input", { type: "checkbox" });
  checkbox.checked = task.completed;
  checkbox.disabled = task.source !== "vault" && !(task.source === "apple-reminders" && options.allowAppleReminderWriteback);
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    row.toggleClass("is-completing", true);
    handlers.onComplete(task);
  });

  const body = row.createDiv({ cls: "task-hub-task-body" });
  body.createDiv({ cls: "task-hub-task-text", text: renderPlainTaskText(task.text) });

  const meta = body.createDiv({ cls: "task-hub-task-meta" });
  if (task.dueDate) meta.createSpan({ text: task.dueDate });
  for (const tag of task.tags) {
    const chip = meta.createEl("button", { cls: "task-hub-task-tag", text: tag });
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onTagSelect(tag);
    });
  }
  meta.createSpan({ cls: "task-hub-task-source", text: task.externalSourceName ?? task.filePath });

  row.addEventListener("click", () => onSelect(task));
  row.addEventListener("dblclick", () => {
    handlers.onJump(task);
  });
  return row;
}

function sortTasksForTaskList(tasks: TaskItem[]): TaskItem[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => compareTaskListDates(left.task, right.task) || left.index - right.index)
    .map(({ task }) => task);
}

function compareTaskListDates(left: TaskItem, right: TaskItem): number {
  const leftDate = taskListDateKey(left);
  const rightDate = taskListDateKey(right);
  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  return leftDate.localeCompare(rightDate);
}

function taskListDateKey(task: TaskItem): string | undefined {
  return task.scheduledDate?.slice(0, 10) ?? task.dueDate ?? task.startDate?.slice(0, 10);
}

function groupSortedTasksByDateBucket(tasks: TaskItem[], now: Date): Record<DateBucket, TaskItem[]> {
  return tasks.reduce<Record<DateBucket, TaskItem[]>>(
    (groups, task) => {
      groups[getTaskBucket(task, now)].push(task);
      return groups;
    },
    { overdue: [], today: [], tomorrow: [], thisWeek: [], future: [], noDate: [], otherCompleted: [] }
  );
}

function renderPlainTaskText(text: string): string {
  return text.replace(/\\([\\`*_[\]{}()#+\-.!|>])/g, "$1");
}

function renderTaskDetails(
  container: HTMLElement,
  task: TaskItem | undefined,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator
): void {
  container.empty();
  const details = container.createDiv({ cls: `task-hub-task-details ${task?.completed ? "is-completed" : ""}` });
  if (task) {
    const color = taskDisplayColor(task, options);
    if (color) details.style.setProperty("--task-hub-source-color", color);
  }
  const header = details.createDiv({ cls: "task-hub-detail-header" });
  renderTaskDetailSourceLogo(header, task);
  header.createEl("h3", { text: t("taskDetails") });
  if (!task) {
    details.createDiv({ cls: "task-hub-empty", text: t("noMatchingTasks") });
    return;
  }

  details.createDiv({ cls: `task-hub-detail-title ${task.completed ? "is-completed" : ""}`, text: task.text });
  const facts = details.createDiv({ cls: "task-hub-detail-facts" });
  facts.createDiv({ text: `${t("completed")}: ${task.completed ? t("completed") : t("open")}` });
  if (task.dueDate) facts.createDiv({ text: `${t("today")}: ${task.dueDate}` });
  if (task.tags.length > 0) facts.createDiv({ text: `${t("tags")}: ${task.tags.join(" ")}` });
  facts.createDiv({ text: `${t("source")}: ${task.externalSourceName ?? task.filePath}` });
  if (task.heading) facts.createDiv({ text: task.heading });
  if (task.contextPreview) {
    details.createEl("h4", { text: t("context") });
    details.createDiv({ cls: "task-hub-detail-context", text: task.contextPreview });
  }

  if (task.source === "apple-reminders" && (options.appleReminderLists?.length ?? 0) > 0) {
    const editor = details.createDiv({ cls: "task-hub-detail-editor" });
    const listRow = editor.createEl("label", { cls: "task-hub-detail-field" });
    listRow.createSpan({ text: t("appleReminderList") });
    const listSelect = listRow.createEl("select");
    for (const list of options.appleReminderLists ?? []) {
      listSelect.createEl("option", { value: list.id, text: list.name });
    }
    if (task.externalListId) {
      listSelect.value = task.externalListId;
    }
    listSelect.disabled = !options.allowAppleReminderCreate || !task.externalId;
    listSelect.addEventListener("change", () => handlers.onAppleReminderListChange(task, listSelect.value));
  }

  const canSendToAppleReminders = task.source === "vault" && Boolean(options.allowAppleReminderCreate);
  const actionLanguageClass = t("language") === "语言" ? "is-compact-language" : "is-long-language";
  const actions = details.createDiv({
    cls: ["task-hub-detail-actions", canSendToAppleReminders ? "has-three-actions" : "", actionLanguageClass]
      .filter(Boolean)
      .join(" ")
  });
  const canToggle = task.source === "vault" || (task.source === "apple-reminders" && options.allowAppleReminderWriteback);
  const completeButton = actions.createEl("button", { text: task.completed ? t("markOpen") : t("markComplete") });
  completeButton.disabled = !canToggle;
  completeButton.addEventListener("click", () => handlers.onComplete(task));
  const openButton = actions.createEl("button", { text: t("openSource") });
  openButton.disabled = !canOpenSource(task);
  openButton.addEventListener("click", () => handlers.onJump(task));
  if (canSendToAppleReminders) {
    const sendButton = actions.createEl("button", { cls: "mod-cta", text: t("sendToAppleReminders") });
    sendButton.addEventListener("click", () => handlers.onSendToAppleReminders(task));
  }
  if (!canToggle && task.source !== "vault") {
    details.createDiv({ cls: "task-hub-detail-note", text: t("externalTaskReadOnly") });
  }
}

function taskDisplayColor(task: TaskItem, options: Pick<TaskRenderOptions, "sourceColors" | "taskColors">): string | undefined {
  return (task.externalListId ? options.taskColors?.[task.externalListId] : undefined) ?? options.sourceColors?.[task.source];
}

function renderTaskDetailSourceLogo(container: HTMLElement, task: TaskItem | undefined): void {
  if (!task) return;
  const source = task.source === "apple-reminders" ? "apple" : "obsidian";
  const logo = container.createSpan({ cls: `task-hub-detail-source-logo is-${source}` });
  logo.setAttr("aria-hidden", "true");
  if (source === "apple") {
    logo.createSvg("svg", { attr: { viewBox: "0 0 24 24", focusable: "false" } })
      .createSvg("path", { attr: { d: "M16.2 2.2c.1 1.2-.4 2.4-1.2 3.3-.8.9-2.1 1.5-3.2 1.4-.1-1.1.4-2.3 1.1-3.1.9-1 2.3-1.6 3.3-1.6ZM20 17.4c-.4.9-.6 1.3-1.1 2.1-.7 1.1-1.8 2.5-3.1 2.5-1.1 0-1.4-.7-2.9-.7s-1.8.7-2.9.7c-1.3 0-2.3-1.3-3.1-2.4-2.1-3.2-2.4-7-.9-9 1-1.3 2.5-2.1 3.9-2.1 1.4 0 2.3.7 3.1.7.8 0 2-.8 3.4-.7 1.2 0 2.4.5 3.3 1.7-2.9 1.6-2.4 5.6.3 7.2Z" } });
    return;
  }
  logo.createSvg("svg", { attr: { viewBox: "0 0 24 24", focusable: "false" } })
    .createSvg("path", { attr: { d: "M12 2 4.8 6.1 3.5 16 12 22l8.5-6-1.3-9.9L12 2Zm0 2.8 4.7 2.7-1 7.2L12 17.4l-3.7-2.7-1-7.2L12 4.8Zm0 3.2-2.2 1.3.5 3.6L12 14l1.7-1.1.5-3.6L12 8Z" } });
}

function canOpenSource(task: TaskItem): boolean {
  return task.source === "vault" || task.source === "apple-reminders";
}
