import { Menu, setIcon } from "obsidian";
import { type DateBucket } from "../calendar/dateBuckets";
import { getTaskBucket, type TaskFilterState } from "../filtering/filters";
import type { Translator } from "../i18n";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "../reminderAlerts";
import type { TaskNote } from "../taskNotes";
import { parseTaskSendTarget, preferredTaskSendTarget, taskSendTargetOptions } from "../taskSendTargets";
import type { AppleReminderList, CalendarItemEditDraft, DidaProject, TaskItem, TaskSendTarget } from "../types";
import { addSourceIndicatorMenuItem, deleteLabelForTaskBulkAction, sourceIndicatorLabelForTask } from "./contextMenuLabels";
import { renderTaskNoteBody, type TaskNoteMarkdownRenderer } from "./renderTaskNoteBody";
import { createRecurrenceSelect, recurrenceValueFromSelect } from "./recurrenceControls";
import { resolveTaskBulkActions, type TaskBulkActionId } from "./taskSelection";
import { renderSourceLogo, sourceLogoKindForTask } from "./sourceLogos";

export type TaskRowHandlers = {
  onComplete: (task: TaskItem) => void;
  onJump: (task: TaskItem) => void;
  onSendToAppleReminders: (task: TaskItem) => void;
  onSendToDida?: (task: TaskItem) => void;
  onSendToTarget?: (task: TaskItem, target: TaskSendTarget) => void;
  onSendToAppleCalendar?: (task: TaskItem) => void;
  onSelect: (task: TaskItem, intent?: TaskSelectionIntent) => void;
  onTagSelect: (tag: string) => void;
  onSourceSelect: (source: "all" | "vault" | "apple-reminders" | "dida") => void;
  onAppleReminderListChange: (task: TaskItem, listId: string) => void;
  onDidaProjectChange?: (task: TaskItem, projectId: string) => void;
  onTaskUpdate?: (task: TaskItem, draft: Extract<CalendarItemEditDraft, { kind: "task" }>) => void;
  onTaskDelete?: (task: TaskItem) => void;
  onCreateTaskNote?: (task: TaskItem) => void;
  onOpenTaskNote?: (path: string) => void;
  onDeleteTaskNote?: (path: string) => void;
  onOpenTaskNoteInThino?: (path: string) => void;
};

export type TaskSelectionIntent = {
  additive: boolean;
  selectedTaskIds: string[];
};

export type TaskRenderOptions = {
  allowAppleReminderCreate?: boolean;
  allowAppleReminderWriteback: boolean;
  allowDidaCreate?: boolean;
  allowDidaWriteback?: boolean;
  allowDidaDelete?: boolean;
  allowAppleCalendarReminderConversion?: boolean;
  selectedTaskId?: string;
  selectedTaskIds?: ReadonlySet<string>;
  sourceColors?: Partial<Record<TaskItem["source"], string>>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  didaProjects?: DidaProject[];
  taskSendDefaultTarget?: TaskSendTarget;
  bindTagInputSuggest?: (input: HTMLInputElement) => void;
  taskListScrollTop?: number;
  exitingTaskIds?: ReadonlySet<string>;
  taskNotesEnabled?: boolean;
  allowThinoNoteEdit?: boolean;
  getTaskNoteCount?: (task: TaskItem) => number;
  getTaskNotes?: (task: TaskItem) => TaskNote[];
  renderNoteMarkdown?: TaskNoteMarkdownRenderer;
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
  const selectedTaskIds = normalizedSelectedTaskIds(options, selectedTask);
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
  const selectTask = (task: TaskItem, event?: MouseEvent) => {
    const additive = Boolean(event?.metaKey || event?.ctrlKey);
    if (additive) {
      if (selectedTaskIds.has(task.id)) {
        selectedTaskIds.delete(task.id);
      } else {
        selectedTaskIds.add(task.id);
      }
      if (selectedTaskIds.size === 0) selectedTaskIds.add(task.id);
    } else {
      selectedTaskIds.clear();
      selectedTaskIds.add(task.id);
    }
    selectedTask = task;
    for (const [taskId, row] of rowsByTaskId) {
      row.toggleClass("is-selected", taskId === task.id);
      row.toggleClass("is-multi-selected", selectedTaskIds.has(taskId));
    }
    if (detailsHost) {
      renderTaskDetails(detailsHost, selectedTask, handlers, options, t);
    }
    handlers.onSelect(task, { additive, selectedTaskIds: [...selectedTaskIds] });
  };
  const selectContextTasks = (task: TaskItem) => {
    if (!selectedTaskIds.has(task.id)) {
      selectedTaskIds.clear();
      selectedTaskIds.add(task.id);
    }
    selectedTask = task;
    for (const [taskId, row] of rowsByTaskId) {
      row.toggleClass("is-selected", taskId === task.id);
      row.toggleClass("is-multi-selected", selectedTaskIds.has(taskId));
    }
    if (detailsHost) {
      renderTaskDetails(detailsHost, selectedTask, handlers, options, t);
    }
    handlers.onSelect(task, { additive: selectedTaskIds.size > 1, selectedTaskIds: [...selectedTaskIds] });
    return sortedTasks.filter((candidate) => selectedTaskIds.has(candidate.id));
  };

  for (const bucket of BUCKETS) {
    const bucketTasks = groups[bucket];
    if (bucketTasks.length === 0) continue;

    const section = list.createDiv({ cls: "task-hub-task-section" });
    section.createEl("h3", { text: `${t(bucket)} (${bucketTasks.length})` });
    const cards = section.createDiv({ cls: "task-hub-task-list-flow" });

    for (const task of bucketTasks) {
      const row = renderTaskRow(
        cards,
        task,
        handlers,
        options,
        t,
        task.id === selectedTask?.id,
        selectedTaskIds.has(task.id),
        selectTask,
        selectContextTasks
      );
      rowsByTaskId.set(task.id, row);
    }
  }
  restoreTaskListScroll(list, options);
  detailsHost = workbench.createDiv({ cls: "task-hub-task-details-host" });
  renderTaskDetails(detailsHost, selectedTask, handlers, options, t);
}

function normalizedSelectedTaskIds(options: TaskRenderOptions, selectedTask: TaskItem | undefined): Set<string> {
  const selectedTaskIds = new Set(options.selectedTaskIds ?? []);
  if (selectedTaskIds.size === 0 && selectedTask) selectedTaskIds.add(selectedTask.id);
  return selectedTaskIds;
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
  t: Translator,
  selected: boolean,
  multiSelected: boolean,
  onSelect: (task: TaskItem, event?: MouseEvent) => void,
  contextTasks: (task: TaskItem) => TaskItem[]
): HTMLElement {
  const classes = [
    "task-hub-task-row",
    selected ? "is-selected" : "",
    multiSelected ? "is-multi-selected" : "",
    task.completed ? "is-completed" : "",
    options.exitingTaskIds?.has(task.id) ? "is-exiting" : ""
  ].filter(Boolean).join(" ");
  const row = container.createDiv({ cls: classes });
  const color = taskDisplayColor(task, options);
  if (color) row.style.setProperty("--task-hub-source-color", color);
  const checkbox = row.createEl("input", { type: "checkbox" });
  checkbox.checked = task.completed;
  checkbox.disabled = task.source !== "vault" && !(task.source === "apple-reminders" && options.allowAppleReminderWriteback) && !(task.source === "dida" && options.allowDidaWriteback);
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    row.toggleClass("is-completing", true);
    handlers.onComplete(task);
  });

  const body = row.createDiv({ cls: "task-hub-task-body" });
  body.createDiv({ cls: "task-hub-task-text", text: renderPlainTaskText(task.text) });
  if (options.taskNotesEnabled && options.getTaskNoteCount && options.getTaskNoteCount(task) > 0) {
    body.createSpan({ cls: "task-hub-task-note-count", text: String(options.getTaskNoteCount(task)) });
  }

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

  row.addEventListener("click", (event) => onSelect(task, event));
  row.addEventListener("dblclick", () => {
    handlers.onJump(task);
  });
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const selectedTasks = contextTasks(task);
    const menu = new Menu();
    addTaskBulkMenuItems(menu, selectedTasks, handlers, options, t);
    menu.showAtMouseEvent(event);
  });
  return row;
}

function addTaskBulkMenuItems(
  menu: Menu,
  tasks: TaskItem[],
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator
): void {
  if (tasks.length === 1) {
    addSourceIndicatorMenuItem(menu, sourceIndicatorLabelForTask(tasks[0], t));
  }
  const actions = resolveTaskBulkActions(tasks, {
    allowAppleReminderWriteback: options.allowAppleReminderWriteback,
    allowAppleReminderCreate: options.allowAppleReminderCreate,
    allowAppleCalendarReminderConversion: options.allowAppleCalendarReminderConversion,
    allowDidaCreate: options.allowDidaCreate,
    allowDidaWriteback: options.allowDidaWriteback,
    allowDidaDelete: options.allowDidaDelete,
    taskNotesEnabled: options.taskNotesEnabled
  });

  for (const action of actions) {
    menu.addItem((item) => {
      const spec = taskBulkMenuSpec(action.id, tasks, t);
      item
        .setTitle(spec.title)
        .setIcon(spec.icon)
        .onClick(() => runTaskBulkAction(action.id, tasks, handlers));
    });
  }
}

function taskBulkMenuSpec(action: TaskBulkActionId, tasks: TaskItem[], t: Translator): { title: string; icon: string } {
  if (action === "create-note") return { title: t("createTaskNote"), icon: "sticky-note" };
  if (action === "mark-complete") return { title: t("markComplete"), icon: "check-square" };
  if (action === "mark-open") return { title: t("markOpen"), icon: "square" };
  if (action === "open-source") return { title: t("openSource"), icon: "external-link" };
  if (action === "send-to-apple-reminders") return { title: t("sendToAppleReminders"), icon: "bell-plus" };
  if (action === "send-to-apple-calendar") return { title: t("sendToAppleCalendar"), icon: "calendar-plus" };
  if (action === "send-to-dida") return { title: t("sendToDida"), icon: "check-circle-2" };
  return { title: deleteLabelForTaskBulkAction(action, tasks, t), icon: "trash" };
}

function runTaskBulkAction(action: TaskBulkActionId, tasks: TaskItem[], handlers: TaskRowHandlers): void {
  for (const task of tasks) {
    if (action === "create-note") handlers.onCreateTaskNote?.(task);
    else if (action === "mark-complete" || action === "mark-open") handlers.onComplete(task);
    else if (action === "open-source") handlers.onJump(task);
    else if (action === "delete") handlers.onTaskDelete?.(task);
    else if (action === "send-to-apple-reminders") handlers.onSendToAppleReminders(task);
    else if (action === "send-to-apple-calendar") handlers.onSendToAppleCalendar?.(task);
    else if (action === "send-to-dida") handlers.onSendToDida?.(task);
  }
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
  const header = details.createDiv({ cls: "task-hub-detail-header task-hub-detail-row" });
  const headerIcon = header.createDiv({ cls: "task-hub-detail-icon-cell" });
  renderTaskDetailSourceLogo(headerIcon, task);
  header.createEl("h3", { cls: "task-hub-detail-label", text: t("taskDetails") });
  header.createDiv({ cls: "task-hub-detail-control" });
  if (!task) {
    details.createDiv({ cls: "task-hub-empty", text: t("noMatchingTasks") });
    return;
  }

  const canEditAppleReminder = task.source === "apple-reminders" && options.allowAppleReminderWriteback && Boolean(task.externalId);
  const canEditDida = task.source === "dida" && Boolean(options.allowDidaWriteback) && Boolean(task.externalId);
  const canEditVaultTask = task.source === "vault";
  const canEditExternalTask = canEditAppleReminder || canEditDida;
  const canEditTask = canEditVaultTask || canEditExternalTask;
  const canToggle = task.source === "vault" || (task.source === "apple-reminders" && options.allowAppleReminderWriteback) || (task.source === "dida" && Boolean(options.allowDidaWriteback));
  if (!canEditTask) {
    const titleRow = detailRow(details, t("taskCreationBody"), (icon) => {
      renderTaskDetailCompleteCheckbox(icon, task, canToggle, handlers, t);
    });
    titleRow.control.createDiv({ cls: `task-hub-detail-title ${task.completed ? "is-completed" : ""}`, text: task.text });
  }
  const facts = details.createDiv({ cls: "task-hub-detail-facts" });
  if (!canEditTask && task.dueDate) renderReadonlyDetailValue(facts, t("date"), task.dueDate);
  if (!canEditTask && task.tags.length > 0) renderReadonlyDetailValue(facts, t("tags"), task.tags.join(" "));
  if (!canEditTask) {
    renderReadonlyDetailValue(facts, t("sourceFile"), taskDetailSourceFileLabel(task), "task-hub-detail-source-file");
  }
  if (!canEditTask && task.contextPreview && !canEditExternalTask) {
    renderReadonlyDetailValue(facts, t("context"), task.contextPreview, "task-hub-detail-context");
  }

  let titleInput: HTMLInputElement | undefined;
  let dateInput: HTMLInputElement | undefined;
  let timeInput: HTMLInputElement | undefined;
  let alertEditor: ReminderAlertEditor | undefined;
  let tagsEditor: TagChipEditor | undefined;
  let recurrenceSelect: HTMLSelectElement | undefined;
  let notesInput: HTMLTextAreaElement | undefined;
  let detailsToggle: HTMLInputElement | undefined;
  let editor: HTMLElement | undefined;
  let dirty = false;
  let lastCommittedSignature = "";
  const markDirty = () => {
    dirty = true;
    details.addClass("is-auto-save-dirty");
  };
  const commitTaskDetailEdit = () => {
    if (!canEditTask || !titleInput || !dateInput || !tagsEditor) return;
    const detailsEnabled = Boolean(detailsToggle?.checked);
    const recurrence = detailsEnabled && recurrenceSelect ? recurrenceValueFromSelect(recurrenceSelect) : undefined;
    const draft = {
      kind: "task" as const,
      title: titleInput.value,
      date: dateInput.value,
      startTime: timeInput?.value || undefined,
      tags: tagsEditor.getTags(),
      alertMinutesBefore: alertEditor?.getAlertMinutesBefore() ?? null,
      ...(detailsEnabled && notesInput ? { notes: notesInput.value } : {}),
      ...(detailsEnabled ? { recurrence: recurrence ?? null } : {})
    };
    const signature = JSON.stringify(draft);
    if (!dirty || signature === lastCommittedSignature) {
      dirty = false;
      details.removeClass("is-auto-save-dirty");
      return;
    }
    dirty = false;
    lastCommittedSignature = signature;
    details.removeClass("is-auto-save-dirty");
    details.addClass("is-auto-save-committed");
    handlers.onTaskUpdate?.(task, draft);
  };
  if (canEditTask) {
    editor = details.createDiv({ cls: "task-hub-detail-editor" });
    if (canEditTask) {
      titleInput = detailInput(
        editor,
        t("taskCreationBody"),
        task.text,
        "text",
        "task-hub-detail-title-input",
        (icon) => renderTaskDetailCompleteCheckbox(icon, task, canToggle, handlers, t)
      );
    }
    if (canEditTask) {
      dateInput = detailInput(editor, t("date"), task.dueDate ?? "", "date");
      if (canEditAppleReminder || canEditVaultTask) {
        timeInput = detailInput(editor, t("startTime"), timeFromTask(task) ?? "", "time");
        if (canEditAppleReminder) {
          alertEditor = reminderAlertEditor(editor, timeInput, task.alertMinutesBefore, t);
        }
      }
    }
    tagsEditor = canEditTask
      ? tagChipEditor(editor, t("tags"), t("tagPlaceholder"), task.tags, options.bindTagInputSuggest, markDirty)
      : undefined;
    if (canEditTask) {
      const toggleRow = detailRow(editor, t("editDetails"));
      detailsToggle = toggleRow.control.createEl("input", { cls: "task-hub-detail-extra-toggle", type: "checkbox" }) as HTMLInputElement;
      toggleRow.row.addClass("task-hub-detail-toggle-row");
      const extra = editor.createDiv({ cls: "task-hub-detail-extra is-hidden" });
      detailsToggle!.addEventListener("change", () => {
        extra.toggleClass("is-hidden", !detailsToggle!.checked);
      });
      renderReadonlyDetailValue(extra, t("sourceFile"), taskDetailSourceFileLabel(task), "task-hub-detail-source-file");
      if (task.contextPreview && !canEditExternalTask) {
        renderReadonlyDetailValue(extra, t("context"), task.contextPreview, "task-hub-detail-context");
      }
      recurrenceSelect = createRecurrenceSelect(extra, t("recurrence"), task.recurrence, t);
      if (canEditExternalTask) {
        notesInput = detailTextarea(extra, t("notes"), task.contextPreview ?? "");
      }
    }
    if (titleInput) options.bindTagInputSuggest?.(titleInput);
    if (canEditTask) {
      const fields = [
        titleInput,
        dateInput,
        timeInput,
        recurrenceSelect,
        notesInput,
        alertEditor?.select
      ].filter((field): field is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => Boolean(field));
      lastCommittedSignature = JSON.stringify({
        kind: "task",
        title: titleInput?.value ?? "",
        date: dateInput?.value ?? "",
        startTime: timeInput?.value || undefined,
        tags: tagsEditor?.getTags() ?? [],
        alertMinutesBefore: alertEditor?.getAlertMinutesBefore() ?? null
      });
      for (const field of fields) {
        field.addEventListener("input", markDirty);
        field.addEventListener("change", markDirty);
        field.addEventListener("blur", commitTaskDetailEdit);
      }
      editor.addEventListener("mouseleave", commitTaskDetailEdit);
    }
  }

  const sendTargetOptions = task.source === "vault"
    ? taskSendOptionsForTaskDetails(options, t)
    : [];
  const canSendToExternalTarget = sendTargetOptions.length > 0;
  const actionLanguageClass = t("language") === "语言" ? "is-compact-language" : "is-long-language";
  if (canSendToExternalTarget) {
    const actions = details.createDiv({
      cls: ["task-hub-detail-actions", "has-send-action", actionLanguageClass]
        .filter(Boolean)
        .join(" ")
    });
    renderTaskSendControl(actions, task, sendTargetOptions, options.taskSendDefaultTarget, handlers, t);
  }
  if (!canToggle && task.source !== "vault") {
    details.createDiv({ cls: "task-hub-detail-note", text: t("externalTaskReadOnly") });
  }
  renderTaskNotes(container, task, handlers, options, t);
}

function renderTaskDetailCompleteCheckbox(
  container: HTMLElement,
  task: TaskItem,
  canToggle: boolean,
  handlers: Pick<TaskRowHandlers, "onComplete">,
  t: Translator
): HTMLInputElement {
  const checkbox = container.createEl("input", { cls: "task-hub-detail-complete-checkbox", type: "checkbox" }) as HTMLInputElement;
  checkbox.checked = task.completed;
  checkbox.disabled = !canToggle;
  checkbox.setAttr("aria-label", task.completed ? t("markOpen") : t("markComplete"));
  checkbox.addEventListener("change", () => handlers.onComplete(task));
  return checkbox;
}

function renderTaskSendControl(
  actions: HTMLElement,
  task: TaskItem,
  options: ReturnType<typeof taskSendOptionsForTaskDetails>,
  defaultTarget: TaskSendTarget | undefined,
  handlers: TaskRowHandlers,
  t: Translator
): void {
  const control = actions.createDiv({ cls: "task-hub-send-control task-hub-detail-row" });
  control.createDiv({ cls: "task-hub-detail-icon-cell" });
  const labelCell = control.createDiv({ cls: "task-hub-detail-label task-hub-send-label-cell" });
  const pickerCell = control.createDiv({ cls: "task-hub-detail-control task-hub-send-picker-cell" });
  const selected = preferredTaskSendTarget(options, defaultTarget) ?? options[0];
  const sendButton = labelCell.createEl("button", { cls: "mod-cta", text: t("sendTo") });
  const picker = renderTaskSendTargetPicker(pickerCell, options, selected.value, t);
  sendButton.addEventListener("click", () => {
    const target = parseTaskSendTarget(picker.getValue());
    if (handlers.onSendToTarget) {
      handlers.onSendToTarget(task, target);
      return;
    }
    if (target.type === "dida") handlers.onSendToDida?.(task);
    else handlers.onSendToAppleReminders(task);
  });
}

function renderTaskSendTargetPicker(
  container: HTMLElement,
  options: ReturnType<typeof taskSendOptionsForTaskDetails>,
  selectedValue: string,
  t: Translator
): { getValue: () => string } {
  let currentValue = selectedValue;
  const current = options.find((option) => option.value === currentValue) ?? options[0];
  currentValue = current.value;
  const details = container.createEl("details", { cls: "task-hub-send-target-menu" }) as HTMLDetailsElement;
  details.addEventListener("toggle", () => {
    container.closest(".task-hub-task-details")?.toggleClass("is-send-menu-open", details.open);
  });
  const summary = details.createEl("summary", { cls: "task-hub-send-target-trigger" });
  summary.setAttr("aria-label", t("sendToTarget"));
  const label = summary.createSpan({ cls: "task-hub-send-target-label", text: current.label });
  const icon = summary.createSpan({ cls: "task-hub-send-target-icon" });
  setIcon(icon, "chevron-down");
  const menu = details.createDiv({ cls: "task-hub-send-target-options" });
  for (const option of options) {
    const item = menu.createEl("button", {
      cls: option.value === currentValue ? "task-hub-send-target-option is-selected" : "task-hub-send-target-option",
      text: option.label
    });
    item.addEventListener("click", (event) => {
      event.preventDefault();
      currentValue = option.value;
      label.setText(option.label);
      for (const sibling of Array.from(menu.children)) {
        sibling.removeClass("is-selected");
      }
      item.addClass("is-selected");
      details.open = false;
      container.closest(".task-hub-task-details")?.removeClass("is-send-menu-open");
    });
  }
  return { getValue: () => currentValue };
}

function taskSendOptionsForTaskDetails(
  options: Pick<TaskRenderOptions, "allowAppleReminderCreate" | "allowDidaCreate" | "appleReminderLists" | "didaProjects">,
  t: Translator
) {
  return taskSendTargetOptions({
    allowAppleReminderCreate: options.allowAppleReminderCreate,
    allowDidaCreate: options.allowDidaCreate,
    appleReminderLists: options.appleReminderLists,
    didaProjects: options.didaProjects
  }, {
    appleReminders: t("localAppleReminders"),
    appleRemindersInbox: t("localAppleRemindersDefaultListInbox"),
    dida: t("dida"),
    didaInbox: t("didaDefaultProjectInbox")
  });
}

function renderTaskNotes(
  container: HTMLElement,
  task: TaskItem,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator
): void {
  if (!options.taskNotesEnabled || !options.getTaskNotes) return;
  const notes = options.getTaskNotes(task);
  if (notes.length === 0) return;
  const notesContainer = container.createDiv({ cls: "task-hub-task-notes" });
  const color = taskDisplayColor(task, options);
  if (color) notesContainer.style.setProperty("--task-hub-source-color", color);
  notesContainer.createEl("h4", { text: t("notes") });
  for (const note of notes) {
    const text = note.body.trim();
    const card = notesContainer.createDiv({ cls: "task-hub-task-note-card" });
    const menuButton = card.createEl("button", { cls: "task-hub-task-note-menu" });
    menuButton.setAttr("aria-label", t("more"));
    setIcon(menuButton, "more-horizontal");
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = new Menu();
      menu.addItem((item) => {
        item
          .setTitle(t("delete"))
          .setIcon("trash")
          .onClick(() => handlers.onDeleteTaskNote?.(note.path));
      });
      menu.addItem((item) => {
        item
          .setTitle(t("edit"))
          .setIcon("pencil")
          .onClick(() => handlers.onOpenTaskNote?.(note.path));
      });
      if (options.allowThinoNoteEdit) {
        menu.addItem((item) => {
          item
            .setTitle(t("taskNoteEditInThino"))
            .setIcon("external-link")
            .onClick(() => handlers.onOpenTaskNoteInThino?.(note.path));
        });
      }
      menu.showAtMouseEvent(event as MouseEvent);
    });
    renderTaskNoteBody(card.createDiv({ cls: "task-hub-task-note-body" }), text, note.path, options.renderNoteMarkdown);
    if (note.createdAt) card.createDiv({ cls: "task-hub-task-note-date", text: note.createdAt.slice(0, 10) });
  }
}

type DetailRow = {
  row: HTMLElement;
  icon: HTMLElement;
  label: HTMLElement;
  control: HTMLElement;
};

function detailRow(container: HTMLElement, label: string, renderIcon?: (icon: HTMLElement) => void): DetailRow {
  const row = container.createDiv({ cls: "task-hub-detail-row" });
  const icon = row.createDiv({ cls: "task-hub-detail-icon-cell" });
  renderIcon?.(icon);
  const labelEl = row.createSpan({ cls: "task-hub-detail-label", text: label });
  const control = row.createDiv({ cls: "task-hub-detail-control" });
  return { row, icon, label: labelEl, control };
}

function renderReadonlyDetailValue(container: HTMLElement, label: string, value: string, valueClass = "task-hub-detail-readonly-value"): void {
  const row = detailRow(container, label);
  row.control.createDiv({ cls: valueClass, text: value });
}

function detailInput(
  container: HTMLElement,
  label: string,
  value: string,
  type = "text",
  inputClass?: string,
  renderIcon?: (icon: HTMLElement) => void
): HTMLInputElement {
  const row = detailRow(container, label, renderIcon);
  const input = row.control.createEl("input", { cls: inputClass, type, value });
  if (type === "date") {
    input.addEventListener("click", () => openNativeDatePicker(input));
    input.addEventListener("focus", () => openNativeDatePicker(input));
  }
  return input;
}

function detailTextarea(container: HTMLElement, label: string, value: string): HTMLTextAreaElement {
  const row = detailRow(container, label);
  const textarea = row.control.createEl("textarea") as HTMLTextAreaElement;
  textarea.value = value;
  return textarea;
}

type ReminderAlertEditor = {
  select: HTMLSelectElement;
  getAlertMinutesBefore: () => ReminderAlertMinutes | null;
};

function reminderAlertEditor(
  container: HTMLElement,
  timeInput: HTMLInputElement,
  initialAlertMinutesBefore: number | undefined,
  t: Translator
): ReminderAlertEditor {
  const row = detailRow(container, t("reminderAlert"));
  row.row.addClass("task-hub-reminder-alert-row");
  const select = row.control.createEl("select", { cls: "task-hub-reminder-alert-select" });
  populateReminderAlertSelect(select, t, { includeNone: true });
  const initial = normalizeReminderAlertMinutes(initialAlertMinutesBefore);
  select.value = initial === undefined ? "" : String(initial);

  const update = () => {
    const hasTime = Boolean(timeInput.value);
    row.row.toggleClass("is-disabled", !hasTime && select.value !== "");
  };
  timeInput.addEventListener("input", update);
  timeInput.addEventListener("change", update);
  select.addEventListener("change", () => {
    if (select.value !== "" && !timeInput.value) {
      timeInput.value = "09:00";
    }
    update();
  });
  update();

  return {
    select,
    getAlertMinutesBefore: () => {
      if (select.value === "" || !timeInput.value) return null;
      return normalizeReminderAlertMinutes(Number(select.value)) ?? 0;
    }
  };
}

function openNativeDatePicker(input: HTMLInputElement): void {
  input.showPicker?.();
}

function splitTaskTags(value: string): string[] {
  return Array.from(new Set(value.split(/\s+/).map(normalizeTaskTag).filter(Boolean)));
}

type TagChipEditor = {
  input: HTMLInputElement;
  getTags: () => string[];
};

function tagChipEditor(
  container: HTMLElement,
  label: string,
  placeholder: string,
  initialTags: string[],
  bindTagInputSuggest?: (input: HTMLInputElement) => void,
  onChange?: () => void
): TagChipEditor {
  const row = detailRow(container, label);
  row.row.addClass("task-hub-tag-editor-field");
  const editor = row.control.createDiv({ cls: "task-hub-tag-editor" });
  editor.setAttr("role", "textbox");
  editor.setAttr("aria-label", label);
  const tags = splitTaskTags(initialTags.join(" "));
  let selectedIndex = -1;
  let composing = false;

  const input = editor.createEl("input", {
    cls: "task-hub-tag-editor-input",
    type: "text",
    value: ""
  });
  input.setAttr("aria-label", label);
  editor.addEventListener("click", (event) => {
    const target = event.target as { classList?: { contains(cls: string): boolean } } | null;
    if (event.target !== input && target?.classList?.contains("task-hub-tag-editor-chip")) return;
    selectedIndex = -1;
    render({ focusInput: true });
  });

  const render = (options: { focusInput?: boolean; focusSelectedChip?: boolean } = {}) => {
    let selectedChip: HTMLElement | undefined;
    for (const child of Array.from(editor.children)) {
      if (child !== input) child.remove();
    }
    editor.toggleClass("is-empty", tags.length === 0);
    if (tags.length === 0) {
      const empty = editor.createSpan({ cls: "task-hub-tag-editor-placeholder", text: placeholder });
      empty.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.focus();
      });
    }
    for (const [index, tag] of tags.entries()) {
      const chip = editor.createSpan({ cls: "task-hub-tag-editor-chip", text: tag });
      chip.toggleClass("is-selected", index === selectedIndex);
      chip.setAttr("tabindex", index === selectedIndex ? "0" : "-1");
      if (index === selectedIndex) selectedChip = chip;
      chip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex = index;
        render({ focusSelectedChip: true });
      });
    }
    editor.appendChild(input);
    if (options.focusSelectedChip && selectedChip) selectedChip.focus();
    else if (options.focusInput) input.focus();
  };

  const commit = () => {
    if (composing) return;
    const nextTags = splitTaskTags(input.value);
    if (nextTags.length === 0) return;
    let changed = false;
    for (const tag of nextTags) {
      if (!tags.includes(tag)) {
        tags.push(tag);
        changed = true;
      }
    }
    input.value = "";
    selectedIndex = -1;
    render({ focusInput: true });
    if (changed) onChange?.();
  };

  const removeSelectedTag = () => {
    if (selectedIndex < 0 || selectedIndex >= tags.length) return false;
    tags.splice(selectedIndex, 1);
    selectedIndex = tags.length === 0 ? -1 : Math.min(selectedIndex, tags.length - 1);
    render(selectedIndex === -1 ? { focusInput: true } : { focusSelectedChip: true });
    onChange?.();
    return true;
  };

  const inputCursorAtStart = () => (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
  const targetIsInput = (target: EventTarget | null) => target === input;

  editor.addEventListener("keydown", (event) => {
    if (event.isComposing || composing) return;
    if ((event.key === "Backspace" || event.key === "Delete") && selectedIndex !== -1) {
      event.preventDefault();
      removeSelectedTag();
      return;
    }
    if (event.key === "ArrowLeft" && (!targetIsInput(event.target) || inputCursorAtStart()) && tags.length > 0) {
      event.preventDefault();
      selectedIndex = selectedIndex === -1 ? tags.length - 1 : Math.max(0, selectedIndex - 1);
      render({ focusSelectedChip: true });
      return;
    }
    if (event.key === "ArrowRight" && selectedIndex !== -1) {
      event.preventDefault();
      selectedIndex = selectedIndex >= tags.length - 1 ? -1 : selectedIndex + 1;
      render(selectedIndex === -1 ? { focusInput: true } : { focusSelectedChip: true });
      return;
    }
    if (targetIsInput(event.target) && (event.key === "Backspace" || event.key === "Delete") && input.value === "" && tags.length > 0) {
      event.preventDefault();
      selectedIndex = tags.length - 1;
      removeSelectedTag();
      return;
    }
    if (!targetIsInput(event.target)) return;
    selectedIndex = -1;
    if (event.key !== "Enter" && event.key !== " " && event.key !== ",") return;
    event.preventDefault();
    commit();
  }, { capture: true });
  input.addEventListener("blur", commit);
  input.addEventListener("input", (event) => {
    if ((event as InputEvent).isComposing || composing) return;
    selectedIndex = -1;
    if (/\s$/u.test(input.value)) commit();
  });
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    if (/\s$/u.test(input.value)) commit();
  });
  input.addEventListener("task-hub-tag-selected", commit);
  bindTagInputSuggest?.(input);
  render();

  return {
    input,
    getTags: () => {
      commit();
      return [...tags];
    }
  };
}

function normalizeTaskTag(tag: string): string {
  const normalized = tag.trim().replace(/^#+/u, "");
  return normalized ? `#${normalized}` : "";
}

function timeFromTask(task: TaskItem): string | undefined {
  return task.scheduledDate?.match(/T(\d{2}:\d{2})/)?.[1];
}

function taskDisplayColor(task: TaskItem, options: Pick<TaskRenderOptions, "sourceColors" | "taskColors">): string | undefined {
  return (task.externalListId ? options.taskColors?.[task.externalListId] : undefined) ?? options.sourceColors?.[task.source];
}

function taskDetailSourceFileLabel(task: TaskItem): string {
  return task.heading ?? task.externalSourceName ?? task.filePath;
}

function renderTaskDetailSourceLogo(container: HTMLElement, task: TaskItem | undefined): void {
  const source = sourceLogoKindForTask(task);
  if (!source) return;
  renderSourceLogo(container, "task-hub-detail-source-logo", source);
}

function canOpenSource(task: TaskItem): boolean {
  return task.source === "vault" || task.source === "apple-reminders" || task.source === "dida";
}
