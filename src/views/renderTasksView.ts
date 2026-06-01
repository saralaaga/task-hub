import { Menu, setIcon } from "obsidian";
import { type DateBucket } from "../calendar/dateBuckets";
import { getTaskBucket, type TaskFilterState } from "../filtering/filters";
import type { Translator } from "../i18n";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "../reminderAlerts";
import type { TaskNote } from "../taskNotes";
import type { AppleReminderList, CalendarItemEditDraft, DidaProject, TaskItem } from "../types";
import { renderTaskNoteBody, type TaskNoteMarkdownRenderer } from "./renderTaskNoteBody";

export type TaskRowHandlers = {
  onComplete: (task: TaskItem) => void;
  onJump: (task: TaskItem) => void;
  onSendToAppleReminders: (task: TaskItem) => void;
  onSendToDida?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
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

export type TaskRenderOptions = {
  allowAppleReminderCreate?: boolean;
  allowAppleReminderWriteback: boolean;
  allowDidaCreate?: boolean;
  allowDidaWriteback?: boolean;
  allowDidaDelete?: boolean;
  selectedTaskId?: string;
  sourceColors?: Partial<Record<TaskItem["source"], string>>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  didaProjects?: DidaProject[];
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
      const row = renderTaskRow(cards, task, handlers, options, t, task.id === selectedTask?.id, selectTask);
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
  t: Translator,
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

  row.addEventListener("click", () => onSelect(task));
  row.addEventListener("dblclick", () => {
    handlers.onJump(task);
  });
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(task);
    const menu = new Menu();
    if (options.taskNotesEnabled) {
      menu.addItem((item) => {
        item
          .setTitle(t("createTaskNote"))
          .setIcon("sticky-note")
          .onClick(() => handlers.onCreateTaskNote?.(task));
      });
    }
    menu.addItem((item) => {
      item
        .setTitle(t("deleteCalendarItem"))
        .setIcon("trash")
        .onClick(() => handlers.onTaskDelete?.(task));
    });
    menu.showAtMouseEvent(event);
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

  const canEditAppleReminder = task.source === "apple-reminders" && options.allowAppleReminderWriteback && Boolean(task.externalId);
  const canEditDida = task.source === "dida" && Boolean(options.allowDidaWriteback) && Boolean(task.externalId);
  const canEditExternalTask = canEditAppleReminder || canEditDida;
  if (!canEditExternalTask) {
    details.createDiv({ cls: `task-hub-detail-title ${task.completed ? "is-completed" : ""}`, text: task.text });
  }
  const facts = details.createDiv({ cls: "task-hub-detail-facts" });
  facts.createDiv({ text: `${t("completed")}: ${task.completed ? t("completed") : t("open")}` });
  if (!canEditExternalTask && task.dueDate) facts.createDiv({ text: `${t("today")}: ${task.dueDate}` });
  if (!canEditExternalTask && task.tags.length > 0) facts.createDiv({ text: `${t("tags")}: ${task.tags.join(" ")}` });
  facts.createDiv({ text: `${t("source")}: ${task.externalSourceName ?? task.filePath}` });
  if (task.heading) facts.createDiv({ text: task.heading });
  if (task.contextPreview) {
    details.createEl("h4", { text: t("context") });
    details.createDiv({ cls: "task-hub-detail-context", text: task.contextPreview });
  }

  let titleInput: HTMLInputElement | undefined;
  let dateInput: HTMLInputElement | undefined;
  let timeInput: HTMLInputElement | undefined;
  let alertEditor: ReminderAlertEditor | undefined;
  let tagsEditor: TagChipEditor | undefined;
  let listSelect: HTMLSelectElement | undefined;
  if ((task.source === "apple-reminders" || task.source === "dida") && (canEditExternalTask || (externalListsForTask(task, options).length > 0))) {
    const editor = details.createDiv({ cls: "task-hub-detail-editor" });
    titleInput = canEditExternalTask
      ? detailInput(editor, t("taskCreationBody"), task.text, "text", "task-hub-detail-title-input")
      : undefined;
    if (canEditExternalTask) {
      const scheduleRow = editor.createDiv({ cls: "task-hub-detail-schedule-row" });
      dateInput = detailInput(scheduleRow, t("date"), task.dueDate ?? "", "date");
      if (canEditAppleReminder) {
        timeInput = detailInput(scheduleRow, t("startTime"), timeFromTask(task) ?? "", "time");
        alertEditor = reminderAlertEditor(editor, timeInput, task.alertMinutesBefore, t);
      }
    }
    tagsEditor = canEditExternalTask
      ? tagChipEditor(editor, t("tags"), task.tags, options.bindTagInputSuggest)
      : undefined;
    if (titleInput) options.bindTagInputSuggest?.(titleInput);
    const externalLists = externalListsForTask(task, options);
    if (externalLists.length > 0) {
      const listRow = editor.createEl("label", { cls: "task-hub-detail-field" });
      listRow.createSpan({ text: task.source === "dida" ? t("didaProject") : t("appleReminderList") });
      listSelect = listRow.createEl("select");
      for (const list of externalLists) {
        listSelect.createEl("option", { value: list.id, text: list.name });
      }
      if (task.externalListId) {
        listSelect.value = task.externalListId;
      }
      listSelect.disabled = !canEditExternalTask && (!options.allowAppleReminderCreate || !options.allowDidaCreate || !task.externalId);
      listSelect.addEventListener("change", () => {
        if (canEditExternalTask) return;
        if (task.source === "dida") handlers.onDidaProjectChange?.(task, listSelect!.value);
        else handlers.onAppleReminderListChange(task, listSelect!.value);
      });
    }
  }

  const canSendToAppleReminders = task.source === "vault" && Boolean(options.allowAppleReminderCreate);
  const canSendToDida = task.source === "vault" && Boolean(options.allowDidaCreate);
  const actionLanguageClass = t("language") === "语言" ? "is-compact-language" : "is-long-language";
  const actions = details.createDiv({
    cls: ["task-hub-detail-actions", canSendToAppleReminders || canSendToDida || canEditExternalTask ? "has-three-actions" : "", actionLanguageClass]
      .filter(Boolean)
      .join(" ")
  });
  if (canEditExternalTask && titleInput && dateInput && tagsEditor) {
    const save = actions.createEl("button", { cls: "mod-cta task-hub-detail-save", text: t("save") });
    save.addEventListener("click", () => {
      handlers.onTaskUpdate?.(task, {
        kind: "task",
        title: titleInput.value,
        date: dateInput.value,
        startTime: timeInput?.value || undefined,
        tags: tagsEditor.getTags(),
        reminderListId: listSelect?.value,
        alertMinutesBefore: alertEditor?.getAlertMinutesBefore() ?? null
      });
    });
  }
  const canToggle = task.source === "vault" || (task.source === "apple-reminders" && options.allowAppleReminderWriteback) || (task.source === "dida" && options.allowDidaWriteback);
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
  if (canSendToDida) {
    const sendButton = actions.createEl("button", { cls: "mod-cta", text: t("sendToDida") });
    sendButton.addEventListener("click", () => handlers.onSendToDida?.(task));
  }
  if (!canToggle && task.source !== "vault") {
    details.createDiv({ cls: "task-hub-detail-note", text: t("externalTaskReadOnly") });
  }
  renderTaskNotes(container, task, handlers, options, t);
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

function detailInput(container: HTMLElement, label: string, value: string, type = "text", inputClass?: string): HTMLInputElement {
  const row = container.createEl("label", { cls: "task-hub-detail-field" });
  row.createSpan({ text: label });
  const input = row.createEl("input", { cls: inputClass, type, value });
  if (type === "date") {
    input.addEventListener("click", () => openNativeDatePicker(input));
    input.addEventListener("focus", () => openNativeDatePicker(input));
  }
  return input;
}

type ReminderAlertEditor = {
  getAlertMinutesBefore: () => ReminderAlertMinutes | null;
};

function reminderAlertEditor(
  container: HTMLElement,
  timeInput: HTMLInputElement,
  initialAlertMinutesBefore: number | undefined,
  t: Translator
): ReminderAlertEditor {
  const row = container.createDiv({ cls: "task-hub-reminder-alert-row" });
  const label = row.createEl("label", { cls: "task-hub-reminder-alert-switch" });
  const toggle = label.createEl("input", { cls: "task-hub-reminder-alert-toggle", type: "checkbox" });
  label.createSpan({ text: t("reminderAlert") });
  const select = row.createEl("select", { cls: "task-hub-reminder-alert-select" });
  populateReminderAlertSelect(select, t);
  const initial = normalizeReminderAlertMinutes(initialAlertMinutesBefore);
  select.value = String(initial ?? 0);
  toggle.checked = initial !== undefined;

  const update = () => {
    const hasTime = Boolean(timeInput.value);
    toggle.disabled = false;
    select.disabled = !toggle.checked;
    row.toggleClass("is-disabled", !hasTime && !toggle.checked);
  };
  timeInput.addEventListener("input", update);
  timeInput.addEventListener("change", update);
  toggle.addEventListener("change", () => {
    if (toggle.checked && !timeInput.value) {
      timeInput.value = "09:00";
    }
    update();
  });
  update();

  return {
    getAlertMinutesBefore: () => {
      if (!toggle.checked || !timeInput.value) return null;
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
  initialTags: string[],
  bindTagInputSuggest?: (input: HTMLInputElement) => void
): TagChipEditor {
  const row = container.createEl("label", { cls: "task-hub-detail-field task-hub-tag-editor-field" });
  row.createSpan({ text: label });
  const editor = row.createDiv({ cls: "task-hub-tag-editor" });
  const tags = splitTaskTags(initialTags.join(" "));
  let selectedIndex = -1;
  let composing = false;

  const input = editor.createEl("input", {
    cls: "task-hub-tag-editor-input",
    type: "text",
    value: ""
  });
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
    for (const tag of nextTags) {
      if (!tags.includes(tag)) tags.push(tag);
    }
    input.value = "";
    selectedIndex = -1;
    render({ focusInput: true });
  };

  const removeSelectedTag = () => {
    if (selectedIndex < 0 || selectedIndex >= tags.length) return false;
    tags.splice(selectedIndex, 1);
    selectedIndex = tags.length === 0 ? -1 : Math.min(selectedIndex, tags.length - 1);
    render(selectedIndex === -1 ? { focusInput: true } : { focusSelectedChip: true });
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

function externalListsForTask(task: TaskItem, options: Pick<TaskRenderOptions, "appleReminderLists" | "didaProjects">): Array<{ id: string; name: string }> {
  if (task.source === "dida") return options.didaProjects ?? [];
  if (task.source === "apple-reminders") return options.appleReminderLists ?? [];
  return [];
}

function renderTaskDetailSourceLogo(container: HTMLElement, task: TaskItem | undefined): void {
  if (!task) return;
  const source = task.source === "apple-reminders" ? "apple" : task.source === "dida" ? "dida" : "obsidian";
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
  return task.source === "vault" || task.source === "apple-reminders" || task.source === "dida";
}
