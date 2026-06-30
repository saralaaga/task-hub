import { Menu, Notice, setIcon } from "obsidian";
import { toLocalDateKey, type DateBucket } from "../calendar/dateBuckets";
import type { CalendarDropTarget } from "../calendar/calendarDropTarget";
import { getTaskBucket, type TaskFilterState } from "../filtering/filters";
import type { Translator } from "../i18n";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "../reminderAlerts";
import { buildSubtaskProgressIndex, type TaskProgressInfo } from "../subtaskProgress";
import type { TaskNote } from "../taskNotes";
import { taskNoteOrderItemKey } from "../taskNoteOrdering";
import { parseTaskSendTarget, preferredTaskSendTarget, taskSendTargetOptions } from "../taskSendTargets";
import { applyTaskListManualOrder, taskListDateKey, type TaskListDropPosition } from "../taskListOrdering";
import { taskPlannedDateKey, taskScheduledStartMinutes } from "../taskDates";
import type { AppleReminderList, CalendarItemEditDraft, DidaProject, TaskHubSmartList, TaskItem, TaskListManualOrder, TaskSendTarget } from "../types";
import { addSourceIndicatorMenuItem, deleteLabelForTaskBulkAction, sourceIndicatorLabelForTask } from "./contextMenuLabels";
import { renderTaskNoteBody, taskNotePreviewBody, taskNotePreviewTitle, type TaskNoteMarkdownRenderer } from "./renderTaskNoteBody";
import { renderTaskFilterPanel, type SourceFilterOption, type TaskFilterControlHandlers } from "./renderShell";
import { createRecurrenceSelect, recurrenceValueFromSelect } from "./recurrenceControls";
import { resolveTaskBulkActions, type TaskBulkActionId } from "./taskSelection";
import { renderSourceLogo, sourceLogoKindForTask } from "./sourceLogos";
import type { TaskHubTagInputElement } from "./tagInputSuggest";
import { createTagChipEditor, type TagChipEditor } from "./tagChipEditor";
import { setCssProps, setCssStyles } from "./domStyles";

export type TaskRowHandlers = {
  onComplete: (task: TaskItem) => void;
  onJump: (task: TaskItem) => void;
  onTaskReschedule?: (task: TaskItem, target: CalendarDropTarget) => void;
  onTaskReorder?: (task: TaskItem, anchorTask: TaskItem, position: TaskListDropPosition) => void;
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
  onOpenTaskNoteSource?: (path: string) => void;
  onOpenTaskNoteInThino?: (path: string) => void;
  onTaskNoteReorder?: (task: TaskItem, draggedNote: TaskNote, anchorNote: TaskNote, position: TaskListDropPosition) => void;
  onToggleTaskNotePinned?: (task: TaskItem, note: TaskNote) => void;
};

export type TaskSelectionIntent = {
  additive: boolean;
  selectedTaskIds: string[];
};

export type TaskRenderOptions = {
  allowAppleReminderCreate?: boolean;
  allowAppleReminderWriteback: boolean;
  allowDidaCreate?: boolean;
  allowDidaDragReschedule?: boolean;
  allowDidaWriteback?: boolean;
  allowDidaDelete?: boolean;
  allowAppleCalendarReminderConversion?: boolean;
  showSubtaskProgressBars?: boolean;
  selectedTaskId?: string;
  selectedTaskIds?: ReadonlySet<string>;
  sourceColors?: Partial<Record<TaskItem["source"], string>>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  didaProjects?: DidaProject[];
  taskSendDefaultTarget?: TaskSendTarget;
  bindTagInputSuggest?: (input: TaskHubTagInputElement) => void;
  taskListScrollTop?: number;
  exitingTaskIds?: ReadonlySet<string>;
  taskNotesEnabled?: boolean;
  allowThinoNoteEdit?: boolean;
  getTaskNoteCount?: (task: TaskItem) => number;
  getTaskNotes?: (task: TaskItem) => TaskNote[];
  isTaskNotePinned?: (task: TaskItem, note: TaskNote) => boolean;
  renderNoteMarkdown?: TaskNoteMarkdownRenderer;
  expandedTaskIds?: ReadonlySet<string>;
  expandingTaskIds?: ReadonlySet<string>;
  onToggleTaskExpanded?: (task: TaskItem) => void;
  taskListManualOrder?: TaskListManualOrder;
  animateTaskListTransition?: boolean;
  availableTags?: string[];
  sourceFilters?: SourceFilterOption[];
  filterHandlers?: TaskFilterControlHandlers;
  smartLists?: TaskHubSmartList[];
  activeSmartListId?: string;
  onSaveSmartList?: (name: string) => void;
  onApplySmartList?: (smartList: TaskHubSmartList) => void;
  onAddTasksToSmartList?: (smartList: TaskHubSmartList, tasks: TaskItem[]) => void;
  onRemoveTasksFromActiveSmartList?: (tasks: TaskItem[]) => void;
  onDeleteSmartList?: (smartList: TaskHubSmartList) => void;
  onRenameSmartList?: (smartList: TaskHubSmartList, name: string) => void;
  onSmartListColorChange?: (smartList: TaskHubSmartList, color: string | undefined) => void;
  smartListCounts?: ReadonlyMap<string, number>;
};

const BUCKETS = ["overdue", "today", "tomorrow", "thisWeek", "future", "noDate", "otherCompleted"] as const;
const TASK_LIST_DRAG_MIME = "application/x-task-hub-task-list-id";
const TASK_LIST_DRAG_IDS_MIME = "application/x-task-hub-task-list-ids";
const TASK_NOTE_DRAG_MIME = "application/x-task-hub-task-note-id";
const TASK_LIST_RESCHEDULE_BUCKETS = ["overdue", "today", "tomorrow", "thisWeek"] as const;
const TASK_PROGRESS_ANIMATION_MS = 240;
const SMART_LIST_COLORS: Array<{ key: "smartListColorDefault" | "smartListColorRed" | "smartListColorOrange" | "smartListColorGreen" | "smartListColorCyan" | "smartListColorBlue" | "smartListColorPurple"; value?: string }> = [
  { key: "smartListColorDefault", value: undefined },
  { key: "smartListColorRed", value: "#d65d5d" },
  { key: "smartListColorOrange", value: "#d97757" },
  { key: "smartListColorGreen", value: "#8aa05f" },
  { key: "smartListColorCyan", value: "#5f9f92" },
  { key: "smartListColorBlue", value: "#6f94b8" },
  { key: "smartListColorPurple", value: "#8f83b5" }
];
let activeDraggedTaskListItemId: string | undefined;
let activeDraggedTaskListItemIds: string[] = [];
let activeDraggedTaskListRows = new Set<HTMLElement>();
let activeTaskListTasksById = new Map<string, TaskItem>();
let activeDraggableTaskListItemIds = new Set<string>();
const previousTaskProgressByContainer = new WeakMap<HTMLElement, Map<string, number>>();

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
  const previousProgressByTaskId = previousTaskProgressByContainer.get(container) ?? new Map<string, number>();

  const hasActiveFilter =
    filters.status !== "open" ||
    Boolean(filters.dateBucket) ||
    filters.tags.length > 0 ||
    Boolean(filters.tagQuery?.trim()) ||
    hasActiveConditionFilters(filters.conditions) ||
    Boolean(filters.sourceQuery) ||
    Boolean(filters.textQuery) ||
    Boolean(options.activeSmartListId);

  if (tasks.length === 0 && !hasActiveFilter) {
    previousTaskProgressByContainer.set(container, new Map());
    container.createDiv({
      cls: "task-hub-empty",
      text: t("noOpenTasks")
    });
    return;
  }

  const sortedTasks = applyTaskListManualOrder(tasks, options.taskListManualOrder ?? {});
  const allProgressByTaskId = buildSubtaskProgressIndex(allTasks);
  const progressByTaskId = options.showSubtaskProgressBars === false ? new Map<string, TaskProgressInfo>() : allProgressByTaskId;
  let selectedTask = sortedTasks.find((task) => task.id === options.selectedTaskId) ?? sortedTasks.find((task) => !task.completed) ?? sortedTasks[0];
  const selectedTaskIds = normalizedSelectedTaskIds(options, selectedTask);
  const hasSidebar = Boolean(options.filterHandlers || options.smartLists?.length || options.onSaveSmartList);
  const workbench = container.createDiv({ cls: `task-hub-task-workbench ${hasSidebar ? "has-filter-sidebar" : ""}` });
  if (hasSidebar) {
    renderTaskSidebar(workbench, filters, options, t);
  }
  const list = workbench.createDiv({
    cls: `task-hub-task-list-pane ${options.animateTaskListTransition ? "task-hub-task-list-pane-transition" : ""}`
  });
  const draggableTaskIds = new Set(sortedTasks.filter((task) => canDragTaskRowInList(task, options, handlers)).map((task) => task.id));
  activeTaskListTasksById = new Map(sortedTasks.map((task) => [task.id, task]));
  activeDraggableTaskListItemIds = new Set(draggableTaskIds);
  const showListDragTargets = draggableTaskIds.size > 0 && Boolean(handlers.onTaskReschedule);

  if (sortedTasks.length === 0) {
    previousTaskProgressByContainer.set(container, new Map());
    list.createDiv({ cls: "task-hub-empty", text: t("noMatchingTasks") });
    restoreTaskListScroll(list, options);
    return;
  }

  const childTasksByParentId = buildChildTasksByParentId(sortedTasks);
  const topLevelTasks = sortedTasks.filter((task) => !task.parentId || !childTasksByParentId.has(task.parentId));
  const groups = groupSortedTasksByDateBucket(topLevelTasks, now);
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
      renderTaskDetails(detailsHost, selectedTask, progressByTaskId.get(selectedTask.id), handlers, options, t);
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
      renderTaskDetails(detailsHost, selectedTask, progressByTaskId.get(selectedTask.id), handlers, options, t);
    }
    handlers.onSelect(task, { additive: selectedTaskIds.size > 1, selectedTaskIds: [...selectedTaskIds] });
    return sortedTasks.filter((candidate) => selectedTaskIds.has(candidate.id));
  };

  for (const bucket of BUCKETS) {
    const bucketTasks = groups[bucket];
    const shouldRenderEmptyDropTarget = showListDragTargets
      && bucketTasks.length === 0
      && isTaskListRescheduleBucket(bucket)
      && bucket !== "overdue";
    if (bucketTasks.length === 0 && !shouldRenderEmptyDropTarget) continue;

    const section = list.createDiv({ cls: `task-hub-task-section ${shouldRenderEmptyDropTarget ? "is-empty-drop-zone" : ""}` });
    section.setAttr("data-task-bucket", bucket);
    section.createEl("h3", { text: `${t(bucket)} (${bucketTasks.length})` });
    const cards = section.createDiv({ cls: "task-hub-task-list-flow" });
    if (shouldRenderEmptyDropTarget) {
      cards.addClass("is-empty-drop-zone");
    }
    bindTaskListBucketDropTarget(section, bucket, sortedTasks, draggableTaskIds, handlers, now);

    for (const task of bucketTasks) {
      renderTaskTree(
        cards,
        task,
        childTasksByParentId,
        progressByTaskId,
        previousProgressByTaskId,
        handlers,
        options,
        t,
        selectTask,
        selectContextTasks,
        rowsByTaskId,
        selectedTask?.id,
        selectedTaskIds,
        0
      );
    }
  }
  restoreTaskListScroll(list, options);
  detailsHost = workbench.createDiv({ cls: "task-hub-task-details-host" });
  renderTaskDetails(detailsHost, selectedTask, selectedTask ? progressByTaskId.get(selectedTask.id) : undefined, handlers, options, t);
  previousTaskProgressByContainer.set(
    container,
    new Map([...allProgressByTaskId.entries()].map(([taskId, info]) => [taskId, info.roundedPercent]))
  );
}

function renderTaskSidebar(
  container: HTMLElement,
  filters: TaskFilterState,
  options: TaskRenderOptions,
  t: Translator
): void {
  const sidebar = container.createDiv({ cls: "task-hub-task-filter-sidebar" });
  if (options.filterHandlers) {
    const controls = sidebar.createDiv({ cls: "task-hub-task-filter-card" });
    renderTaskFilterPanel(
      controls,
      {
        availableTags: options.availableTags ?? [],
        filters,
        sourceFilters: options.sourceFilters,
        t
      },
      options.filterHandlers,
      { bindTagInputSuggest: options.bindTagInputSuggest }
    );
  }

  const smartLists = sidebar.createDiv({ cls: "task-hub-smart-list-card" });
  const header = smartLists.createDiv({ cls: "task-hub-smart-list-header" });
  header.createSpan({ cls: "task-hub-smart-list-title", text: t("smartLists") });
  const actions = header.createDiv({ cls: "task-hub-smart-list-header-actions" });
  if (options.activeSmartListId && options.onRemoveTasksFromActiveSmartList) {
    const remove = actions.createSpan({ cls: "task-hub-smart-list-remove-drop" });
    remove.setAttr("role", "button");
    remove.setAttr("tabindex", "0");
    remove.setAttr("aria-label", t("removeFromSmartListHint"));
    remove.setAttr("title", t("removeFromSmartListHint"));
    setIcon(remove, "trash-2");
    const showHint = () => new Notice(t("removeFromSmartListHint"));
    remove.addEventListener("click", showHint);
    remove.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showHint();
    });
    bindActiveSmartListRemoveDropTarget(remove, options, t);
  }
  if (options.onSaveSmartList) {
    const save = actions.createEl("button", { cls: "task-hub-icon-button task-hub-smart-list-save" });
    save.setAttr("aria-label", t("saveSmartList"));
    setIcon(save, "plus");
    save.addEventListener("click", () => {
      renderSmartListCreateForm(smartLists, options.onSaveSmartList, t);
    });
  }

  const list = smartLists.createDiv({ cls: "task-hub-smart-list-items" });
  const items = options.smartLists ?? [];
  if (items.length === 0) {
    list.createDiv({ cls: "task-hub-smart-list-empty", text: t("noSmartLists") });
    return;
  }

  for (const smartList of items) {
    const item = list.createDiv({
      cls: `task-hub-smart-list-item ${options.activeSmartListId === smartList.id ? "is-active" : ""}`
    });
    setCssProps(item, { "--task-hub-smart-list-color": smartList.color ?? "var(--interactive-accent)" });
    renderSmartListItemContent(item, smartList, options);
    bindSmartListDropTarget(item, smartList, options, t);
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      renderSmartListContextMenu(item, event, smartList, options, t);
    });
  }
}

function renderSmartListItemContent(item: HTMLElement, smartList: TaskHubSmartList, options: TaskRenderOptions): void {
  item.empty();
  item.removeClass("is-editing");
  const apply = item.createEl("button", { cls: "task-hub-smart-list-apply" });
  apply.createSpan({ cls: "task-hub-smart-list-item-name", text: smartList.name });
  const count = options.smartListCounts?.get(smartList.id) ?? smartList.taskStableIds.length + smartList.taskIds.length;
  if (count > 0) apply.createSpan({ cls: "task-hub-smart-list-item-count", text: String(count) });
  apply.addEventListener("click", () => options.onApplySmartList?.(smartList));
}

function bindSmartListDropTarget(
  item: HTMLElement,
  smartList: TaskHubSmartList,
  options: TaskRenderOptions,
  t: Translator
): void {
  if (!options.onAddTasksToSmartList) return;
  item.addEventListener("dragover", (event) => {
    const tasks = activeTaskListTasksFromDragEvent(event);
    if (tasks.length === 0) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    item.addClass("is-drop-target");
  });
  item.addEventListener("dragleave", () => {
    item.removeClass("is-drop-target");
  });
  item.addEventListener("drop", (event) => {
    const tasks = activeTaskListTasksFromDragEvent(event);
    clearActiveTaskListDrag();
    item.removeClass("is-drop-target");
    if (tasks.length === 0) return;
    event.preventDefault();
    options.onAddTasksToSmartList?.(smartList, tasks);
    showSmartListDragNotice(t, "smartListDragInNotice", smartList.name, tasks.length);
  });
}

function bindActiveSmartListRemoveDropTarget(button: HTMLElement, options: TaskRenderOptions, t: Translator): void {
  button.addEventListener("dragover", (event) => {
    const tasks = activeTaskListTasksFromDragEvent(event);
    if (tasks.length === 0) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    button.addClass("is-drop-target");
  });
  button.addEventListener("dragleave", () => {
    button.removeClass("is-drop-target");
  });
  button.addEventListener("drop", (event) => {
    const tasks = activeTaskListTasksFromDragEvent(event);
    clearActiveTaskListDrag();
    button.removeClass("is-drop-target");
    if (tasks.length === 0) return;
    event.preventDefault();
    options.onRemoveTasksFromActiveSmartList?.(tasks);
    const name = activeSmartListName(options);
    if (name) showSmartListDragNotice(t, "smartListDragOutNotice", name, tasks.length);
  });
}

function renderSmartListContextMenu(anchor: HTMLElement, event: MouseEvent, smartList: TaskHubSmartList, options: TaskRenderOptions, t: Translator): void {
  const root = anchor.doc.body;
  root.querySelector(".task-hub-smart-list-context-menu")?.remove();
  const menu = root.createDiv({ cls: "menu task-hub-smart-list-context-menu" });
  setCssStyles(menu, {
    left: `${event.clientX}px`,
    top: `${event.clientY}px`
  });
  menu.addEventListener("click", (clickEvent) => clickEvent.stopPropagation());
  menu.addEventListener("mouseleave", () => menu.remove());

  if (options.onSmartListColorChange) {
    const group = menu.createDiv({ cls: "task-hub-smart-list-context-group has-submenu" });
    const trigger = group.createDiv({ cls: "menu-item task-hub-smart-list-context-action" });
    trigger.setAttr("role", "menuitem");
    trigger.setAttr("tabindex", "0");
    trigger.createSpan({ cls: "menu-item-title task-hub-smart-list-context-label", text: t("smartListColor") });
    trigger.createSpan({ cls: "menu-item-icon task-hub-smart-list-context-arrow", text: ">" });
    const submenu = group.createDiv({ cls: "menu task-hub-smart-list-color-submenu" });
    positionSmartListColorSubmenu(group, submenu);
    group.addEventListener("mouseenter", () => positionSmartListColorSubmenu(group, submenu));
    group.addEventListener("focusin", () => positionSmartListColorSubmenu(group, submenu));
    for (const color of SMART_LIST_COLORS) {
      const isSelected = smartList.color === color.value || (!smartList.color && !color.value);
      const colorAction = submenu.createDiv({
        cls: `menu-item task-hub-smart-list-color-action ${isSelected ? "is-selected" : ""}`
      });
      colorAction.setAttr("role", "menuitem");
      colorAction.setAttr("tabindex", "0");
      const icon = colorAction.createSpan({ cls: "menu-item-icon task-hub-smart-list-color-icon" });
      const dot = icon.createSpan({ cls: "task-hub-smart-list-menu-color-dot" });
      setCssProps(dot, { "--task-hub-smart-list-menu-color": color.value ?? "var(--interactive-accent)" });
      colorAction.createSpan({ cls: "menu-item-title task-hub-smart-list-color-label", text: t(color.key) });
      if (isSelected) {
        const check = colorAction.createSpan({ cls: "menu-item-icon task-hub-smart-list-color-check" });
        setIcon(check, "check");
        colorAction.setAttr("aria-current", "true");
      }
      colorAction.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        options.onSmartListColorChange?.(smartList, color.value);
        menu.remove();
      });
      colorAction.addEventListener("keydown", (keyEvent) => {
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        options.onSmartListColorChange?.(smartList, color.value);
        menu.remove();
      });
    }
  }

  if (options.onRenameSmartList) {
    const renameAction = menu.createDiv({ cls: "menu-item task-hub-smart-list-context-action" });
    renameAction.setAttr("role", "menuitem");
    renameAction.setAttr("tabindex", "0");
    renameAction.createSpan({ cls: "menu-item-title task-hub-smart-list-context-label", text: t("renameSmartList") });
    const rename = () => {
      menu.remove();
      renderSmartListRenameInput(anchor, smartList, options, t);
    };
    renameAction.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      rename();
    });
    renameAction.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
      keyEvent.preventDefault();
      rename();
    });
  }

  if ((options.onSmartListColorChange || options.onRenameSmartList) && options.onDeleteSmartList) {
    menu.createDiv({ cls: "menu-separator task-hub-smart-list-context-separator" });
  }

  if (options.onDeleteSmartList) {
    const deleteAction = menu.createDiv({ cls: "menu-item task-hub-smart-list-context-action" });
    deleteAction.setAttr("role", "menuitem");
    deleteAction.setAttr("tabindex", "0");
    deleteAction.createSpan({ cls: "menu-item-title task-hub-smart-list-context-label", text: t("deleteSmartList") });
    deleteAction.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      options.onDeleteSmartList?.(smartList);
      menu.remove();
    });
    deleteAction.addEventListener("keydown", (keyEvent) => {
      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
      keyEvent.preventDefault();
      options.onDeleteSmartList?.(smartList);
      menu.remove();
    });
  }
}

function renderSmartListRenameInput(item: HTMLElement, smartList: TaskHubSmartList, options: TaskRenderOptions, t: Translator): void {
  item.empty();
  item.addClass("is-editing");
  const input = item.createEl("input", {
    cls: "task-hub-smart-list-rename-input",
    attr: { "aria-label": t("renameSmartList") },
    type: "text",
    value: smartList.name
  }) as HTMLInputElement;
  let committed = false;
  const restore = () => renderSmartListItemContent(item, smartList, options);
  const commit = () => {
    if (committed) return;
    committed = true;
    const name = input.value.trim();
    if (!name || name === smartList.name) {
      restore();
      return;
    }
    options.onRenameSmartList?.(smartList, name);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      committed = true;
      restore();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  });
  input.addEventListener("blur", commit);
  input.focus();
  input.selectionStart = 0;
  input.selectionEnd = smartList.name.length;
}

function positionSmartListColorSubmenu(group: HTMLElement, submenu: HTMLElement): void {
  const rect = group.getBoundingClientRect();
  setCssStyles(submenu, {
    left: `${rect.right + 4}px`,
    top: `${rect.top - 5}px`
  });
}

function renderSmartListCreateForm(container: HTMLElement, onSave: ((name: string) => void) | undefined, t: Translator): void {
  if (!onSave) return;
  container.querySelector(".task-hub-smart-list-create-form")?.remove();
  const form = container.createDiv({ cls: "task-hub-smart-list-create-form" });
  const input = form.createEl("input", {
    cls: "task-hub-smart-list-name-input",
    attr: { placeholder: t("smartListNamePrompt") },
    type: "text"
  });
  const actions = form.createDiv({ cls: "task-hub-smart-list-create-actions" });
  const cancel = actions.createEl("button", { cls: "task-hub-smart-list-create-cancel", text: t("cancel") });
  const save = actions.createEl("button", { cls: "task-hub-smart-list-create-save mod-cta", text: t("save") });
  save.disabled = true;
  const updateSaveState = () => {
    save.disabled = input.value.trim().length === 0;
  };
  const submit = () => {
    const name = input.value.trim();
    if (!name) return;
    onSave(name);
    form.remove();
  };
  input.addEventListener("input", updateSaveState);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit();
  });
  cancel.addEventListener("click", () => form.remove());
  save.addEventListener("click", submit);
  input.focus();
}

function renderTaskTree(
  container: HTMLElement,
  task: TaskItem,
  childTasksByParentId: Map<string, TaskItem[]>,
  progressByTaskId: Map<string, TaskProgressInfo>,
  previousProgressByTaskId: Map<string, number>,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator,
  onSelect: (task: TaskItem, event?: MouseEvent) => void,
  contextTasks: (task: TaskItem) => TaskItem[],
  rowsByTaskId: Map<string, HTMLElement>,
  selectedTaskId: string | undefined,
  selectedTaskIds: Set<string>,
  depth: number
): void {
  const children = childTasksByParentId.get(task.id) ?? [];
  const isExpanded = options.expandedTaskIds?.has(task.id) ?? false;
  const isExpanding = options.expandingTaskIds?.has(task.id) ?? false;
  const { row, subtaskToggle } = renderTaskRow(
    container,
    task,
    progressByTaskId.get(task.id),
    previousProgressByTaskId.get(task.id),
    handlers,
    options,
    t,
    task.id === selectedTaskId,
    selectedTaskIds.has(task.id),
    onSelect,
    contextTasks,
    children.length,
    isExpanded,
    depth,
    rowsByTaskId,
    selectedTaskIds
  );
  rowsByTaskId.set(task.id, row);
  if (subtaskToggle) {
    subtaskToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isExpanded) {
        options.onToggleTaskExpanded?.(task);
        return;
      }

      const childContainer = findImmediateSubtaskList(row);
      if (!childContainer) {
        options.onToggleTaskExpanded?.(task);
        return;
      }

      subtaskToggle.disabled = true;
      animateSubtaskListExit(childContainer, () => options.onToggleTaskExpanded?.(task));
    });
  }
  if (children.length === 0 || !isExpanded) return;
  const childContainer = container.createDiv({ cls: "task-hub-subtask-list" });
  childContainer.setAttr("data-parent-task-id", task.id);
  for (const child of children) {
    renderTaskTree(
      childContainer,
      child,
      childTasksByParentId,
      progressByTaskId,
      previousProgressByTaskId,
      handlers,
      options,
      t,
      onSelect,
      contextTasks,
      rowsByTaskId,
      selectedTaskId,
      selectedTaskIds,
      depth + 1
    );
  }
  if (isExpanding) {
    animateSubtaskListEnter(childContainer);
  }
}

function animateSubtaskListEnter(list: HTMLElement): void {
  const reducedMotion = list.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  list.addClass("is-opening");
  setCssStyles(list, { maxHeight: "0px" });
  void list.offsetHeight;
  setCssStyles(list, { maxHeight: `${measureSubtaskListHeight(list)}px` });

  let finished = false;
  const finish = (event?: TransitionEvent) => {
    if (finished) return;
    if (event?.propertyName && event.propertyName !== "max-height") return;
    finished = true;
    list.removeClass("is-opening");
    setCssStyles(list, { maxHeight: "" });
    list.removeEventListener?.("transitionend", finish);
  };

  list.addEventListener("transitionend", finish);
  setTimeout(() => finish(), 260);
}

function animateSubtaskListExit(list: HTMLElement, onFinish: () => void): void {
  const reducedMotion = list.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    onFinish();
    return;
  }

  list.removeClass("is-opening");
  list.addClass("is-closing");
  setCssStyles(list, { maxHeight: `${measureSubtaskListHeight(list)}px` });
  void list.offsetHeight;
  setCssStyles(list, { maxHeight: "0px" });

  let finished = false;
  const finish = (event?: TransitionEvent) => {
    if (finished) return;
    if (event?.propertyName && event.propertyName !== "max-height") return;
    finished = true;
    list.removeEventListener?.("transitionend", finish);
    onFinish();
  };

  list.addEventListener("transitionend", finish);
  setTimeout(() => finish(), 260);
}

function measureSubtaskListHeight(list: HTMLElement): number {
  if (typeof list.scrollHeight === "number" && Number.isFinite(list.scrollHeight) && list.scrollHeight > 0) {
    return list.scrollHeight;
  }

  const childCount = list.childElementCount || list.children.length;
  return Math.max(childCount * 56 + Math.max(0, childCount - 1) * 6, 56);
}

function findImmediateSubtaskList(row: HTMLElement): HTMLElement | undefined {
  const parent = row.parentElement;
  if (!parent) return undefined;
  const siblings = Array.from(parent.children);
  const rowIndex = siblings.indexOf(row);
  if (rowIndex === -1) return undefined;
  const nextSibling = siblings[rowIndex + 1] as HTMLElement | undefined;
  if (!nextSibling) return undefined;
  const hasSubtaskClass =
    "classList" in nextSibling
      ? nextSibling.classList.contains("task-hub-subtask-list")
      : (nextSibling as HTMLElement & { classes?: Set<string> }).classes?.has("task-hub-subtask-list");
  return hasSubtaskClass ? nextSibling : undefined;
}

function normalizedSelectedTaskIds(options: TaskRenderOptions, selectedTask: TaskItem | undefined): Set<string> {
  const selectedTaskIds = new Set(options.selectedTaskIds ?? []);
  if (selectedTaskIds.size === 0 && selectedTask) selectedTaskIds.add(selectedTask.id);
  return selectedTaskIds;
}

function hasActiveConditionFilters(conditions: TaskFilterState["conditions"]): boolean {
  if (!conditions) return false;
  return Boolean(conditions.tag.trim() || conditions.dateBucket || conditions.text.trim());
}

function restoreTaskListScroll(list: HTMLElement, options: TaskRenderOptions): void {
  if (options.taskListScrollTop !== undefined) {
    list.scrollTop = options.taskListScrollTop;
  }
}

function renderTaskRow(
  container: HTMLElement,
  task: TaskItem,
  progressInfo: TaskProgressInfo | undefined,
  previousProgressPercent: number | undefined,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator,
  selected: boolean,
  multiSelected: boolean,
  onSelect: (task: TaskItem, event?: MouseEvent) => void,
  contextTasks: (task: TaskItem) => TaskItem[],
  childCount = 0,
  expanded = false,
  depth = 0,
  rowsByTaskId?: Map<string, HTMLElement>,
  selectedTaskIds?: Set<string>
): { row: HTMLElement; subtaskToggle?: HTMLButtonElement } {
  const taskNoteCount = options.taskNotesEnabled && options.getTaskNoteCount ? options.getTaskNoteCount(task) : 0;
  const classes = [
    "task-hub-task-row",
    selected ? "is-selected" : "",
    multiSelected ? "is-multi-selected" : "",
    task.completed ? "is-completed" : "",
    taskNoteCount > 0 ? "has-task-note-count" : "",
    childCount > 0 ? "has-subtask-toggle" : "",
    options.exitingTaskIds?.has(task.id) ? "is-exiting" : ""
  ].filter(Boolean).join(" ");
  const row = container.createDiv({ cls: classes });
  row.setAttr("data-task-depth", String(depth));
  row.setAttr("data-task-id", task.id);
  const color = taskDisplayColor(task, options);
  if (color) setCssProps(row, { "--task-hub-source-color": color });
  bindTaskRowDrag(row, task, handlers, options, selectedTaskIds, rowsByTaskId, t);
  bindTaskRowReorderDropTarget(row, task, handlers, options);
  const checkbox = row.createEl("input", { type: "checkbox" });
  checkbox.checked = task.completed;
  checkbox.disabled = task.source !== "vault" && !(task.source === "apple-reminders" && options.allowAppleReminderWriteback) && !(task.source === "dida" && options.allowDidaWriteback);
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    row.toggleClass("is-completing", true);
    handlers.onComplete(task);
  });

  const content = row.createDiv({ cls: "task-hub-task-content" });
  const body = content.createDiv({ cls: "task-hub-task-body" });
  const titleLine = body.createDiv({ cls: "task-hub-task-title-line" });
  titleLine.createDiv({ cls: "task-hub-task-text", text: renderPlainTaskText(task.text) });
  for (const tag of task.tags) {
    const chip = titleLine.createEl("button", { cls: "task-hub-task-tag", text: tag });
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onTagSelect(tag);
    });
  }
  if (progressInfo && options.showSubtaskProgressBars !== false) {
    row.addClass("has-progress");
    renderTaskProgressRow(content, progressInfo, previousProgressPercent);
  }
  if (taskNoteCount > 0) {
    content.createSpan({ cls: "task-hub-task-note-count", text: String(taskNoteCount) });
  }
  let subtaskToggle: HTMLButtonElement | undefined;
  if (childCount > 0) {
    subtaskToggle = content.createEl("button", {
      cls: `task-hub-subtask-toggle ${expanded ? "is-expanded" : ""}`,
      attr: {
        "aria-label": expanded ? "Collapse subtasks" : "Expand subtasks",
        "aria-expanded": String(expanded)
      }
    }) as HTMLButtonElement;
    setIcon(subtaskToggle, "chevron-right");
  }

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
  return { row, subtaskToggle };
}

function buildChildTasksByParentId(tasks: TaskItem[]): Map<string, TaskItem[]> {
  const taskIds = new Set(tasks.map((task) => task.id));
  const children = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    if (!task.parentId || !taskIds.has(task.parentId)) continue;
    children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  }
  return children;
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

function groupSortedTasksByDateBucket(tasks: TaskItem[], now: Date): Record<DateBucket, TaskItem[]> {
  return tasks.reduce<Record<DateBucket, TaskItem[]>>(
    (groups, task) => {
      groups[getTaskBucket(task, now)].push(task);
      return groups;
    },
    { overdue: [], today: [], tomorrow: [], thisWeek: [], future: [], noDate: [], otherCompleted: [] }
  );
}

function bindTaskRowDrag(
  row: HTMLElement,
  task: TaskItem,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  selectedTaskIds: ReadonlySet<string> | undefined,
  rowsByTaskId: ReadonlyMap<string, HTMLElement> | undefined,
  t: Translator
): void {
  if (!canDragTaskRowInList(task, options, handlers)) return;
  row.draggable = true;
  row.setAttr("draggable", "true");
  row.setAttr("aria-grabbed", "false");
  row.addEventListener("dragstart", (event) => {
    const draggedIds = taskListDragIdsForTask(task, selectedTaskIds);
    activeDraggedTaskListItemId = task.id;
    activeDraggedTaskListItemIds = draggedIds;
    markActiveTaskListDragRows(draggedIds, task.id, rowsByTaskId);
    const smartListName = activeSmartListName(options);
    if (smartListName) {
      new Notice(formatSmartListDragNotice(t("smartListDragStartNotice"), smartListName, draggedIds.length));
    }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData(TASK_LIST_DRAG_MIME, task.id);
      event.dataTransfer.setData(TASK_LIST_DRAG_IDS_MIME, JSON.stringify(draggedIds));
    }
  });
  row.addEventListener("dragend", () => {
    if (activeDraggedTaskListItemId === task.id) clearActiveTaskListDrag();
  });
}

function bindTaskRowReorderDropTarget(
  row: HTMLElement,
  task: TaskItem,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions
): void {
  if (!handlers.onTaskReorder) return;

  row.addEventListener("dragover", (event) => {
    const draggedTask = activeTaskListTaskFromDragEvent(event);
    const position = taskRowDropPosition(row, event);
    if (!canReorderTaskRow(draggedTask, task, handlers, options)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setTaskRowDropClasses(row, position);
  });

  row.addEventListener("dragleave", () => clearTaskRowDropClasses(row));
  row.addEventListener("drop", (event) => {
    const draggedTask = activeTaskListTaskFromDragEvent(event);
    const position = taskRowDropPosition(row, event);
    clearTaskRowDropClasses(row);
    if (!canReorderTaskRow(draggedTask, task, handlers, options)) return;
    clearActiveTaskListDrag();
    event.preventDefault();
    handlers.onTaskReorder?.(draggedTask, task, position);
  });
}

function bindTaskListBucketDropTarget(
  section: HTMLElement,
  bucket: DateBucket,
  tasks: TaskItem[],
  draggableTaskIds: ReadonlySet<string>,
  handlers: TaskRowHandlers,
  now: Date
): void {
  const targetDate = taskListDropDateForBucket(bucket, now);
  if (!targetDate || !handlers.onTaskReschedule) return;

  section.addEventListener("dragover", (event) => {
    const draggedTasks = taskListTasksFromDragEvent(event, tasks, draggableTaskIds);
    if (tasksDroppableOnBucket(draggedTasks, bucket, now).length === 0) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    section.addClass("is-drop-target");
  });
  section.addEventListener("dragleave", () => {
    section.removeClass("is-drop-target");
  });
  section.addEventListener("drop", (event) => {
    const draggedTasks = taskListTasksFromDragEvent(event, tasks, draggableTaskIds);
    clearActiveTaskListDrag();
    section.removeClass("is-drop-target");
    const droppableTasks = tasksDroppableOnBucket(draggedTasks, bucket, now);
    if (droppableTasks.length === 0) return;
    event.preventDefault();
    for (const task of droppableTasks) {
      handlers.onTaskReschedule?.(task, taskListDropTarget(task, targetDate));
    }
  });
}

function taskListTasksFromDragEvent(
  event: DragEvent,
  tasks: TaskItem[],
  draggableTaskIds: ReadonlySet<string>
): TaskItem[] {
  const draggedIds = taskListDragIdsFromEvent(event);
  if (draggedIds.length === 0) return [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  return draggedIds
    .filter((taskId) => draggableTaskIds.has(taskId))
    .map((taskId) => tasksById.get(taskId))
    .filter((task): task is TaskItem => Boolean(task));
}

function activeTaskListTaskFromDragEvent(event: DragEvent): TaskItem | undefined {
  const draggedId = taskListDragIdsFromEvent(event)[0];
  if (!draggedId || !activeDraggableTaskListItemIds.has(draggedId)) return undefined;
  return activeTaskListTasksById.get(draggedId);
}

function activeTaskListTasksFromDragEvent(event: DragEvent): TaskItem[] {
  return taskListDragIdsFromEvent(event)
    .filter((taskId) => activeDraggableTaskListItemIds.has(taskId))
    .map((taskId) => activeTaskListTasksById.get(taskId))
    .filter((task): task is TaskItem => Boolean(task));
}

function taskListDragIdsForTask(task: TaskItem, selectedTaskIds: ReadonlySet<string> | undefined): string[] {
  if (!selectedTaskIds?.has(task.id)) return [task.id];
  const ids = [...selectedTaskIds].filter((taskId) => activeDraggableTaskListItemIds.has(taskId));
  return ids.length > 0 ? ids : [task.id];
}

function taskListDragIdsFromEvent(event: DragEvent): string[] {
  if (activeDraggedTaskListItemIds.length > 0) return activeDraggedTaskListItemIds;
  const encodedIds = event.dataTransfer?.getData(TASK_LIST_DRAG_IDS_MIME);
  if (encodedIds) {
    try {
      const parsed = JSON.parse(encodedIds) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0);
      }
    } catch {
      // Fall through to the single-task payload for older drag data.
    }
  }
  const draggedId = activeDraggedTaskListItemId ?? event.dataTransfer?.getData(TASK_LIST_DRAG_MIME);
  return draggedId ? [draggedId] : [];
}

function clearActiveTaskListDrag(): void {
  clearActiveTaskListDragRows();
  activeDraggedTaskListItemId = undefined;
  activeDraggedTaskListItemIds = [];
}

function clearActiveTaskListDragRows(): void {
  for (const row of activeDraggedTaskListRows) {
    row.removeClass("is-dragging");
    row.removeClass("is-bulk-dragging");
    row.setAttr("aria-grabbed", "false");
  }
  activeDraggedTaskListRows.clear();
}

function markActiveTaskListDragRows(
  taskIds: string[],
  primaryTaskId: string,
  rowsByTaskId: ReadonlyMap<string, HTMLElement> | undefined
): void {
  clearActiveTaskListDragRows();
  for (const taskId of taskIds) {
    const row = rowsByTaskId?.get(taskId);
    if (!row) continue;
    row.addClass(taskId === primaryTaskId ? "is-dragging" : "is-bulk-dragging");
    row.setAttr("aria-grabbed", "true");
    activeDraggedTaskListRows.add(row);
  }
}

function activeSmartListName(options: TaskRenderOptions): string | undefined {
  if (!options.activeSmartListId) return undefined;
  return options.smartLists?.find((smartList) => smartList.id === options.activeSmartListId)?.name;
}

function showSmartListDragNotice(
  t: Translator,
  key: "smartListDragInNotice" | "smartListDragOutNotice",
  name: string,
  count: number
): void {
  new Notice(formatSmartListDragNotice(t(key), name, count));
}

function formatSmartListDragNotice(template: string, name: string, count: number): string {
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{count\}/g, String(count));
}

function tasksDroppableOnBucket(tasks: TaskItem[], bucket: DateBucket, now: Date): TaskItem[] {
  return tasks.filter((task) => getTaskBucket(task, now) !== bucket);
}

function canDragTaskRowInList(
  task: TaskItem,
  options: TaskRenderOptions,
  handlers: { onTaskReschedule?: TaskRowHandlers["onTaskReschedule"]; onTaskReorder?: TaskRowHandlers["onTaskReorder"] }
): boolean {
  if (!handlers.onTaskReschedule && !handlers.onTaskReorder) return false;
  if (task.source === "vault") return true;
  if (task.source === "apple-reminders") return options.allowAppleReminderWriteback && Boolean(task.externalId);
  if (task.source === "dida") {
    return Boolean(options.allowDidaWriteback && options.allowDidaDragReschedule && task.externalId && task.externalListId);
  }
  return false;
}

function canReorderTaskRow(
  draggedTask: TaskItem | undefined,
  targetTask: TaskItem,
  handlers: Pick<TaskRowHandlers, "onTaskReorder">,
  options: TaskRenderOptions
): draggedTask is TaskItem {
  if (!draggedTask || !handlers.onTaskReorder) return false;
  if (activeDraggedTaskListItemIds.length > 1) return false;
  if (!canDragTaskRowInList(draggedTask, options, handlers)) return false;
  if (draggedTask.id === targetTask.id) return false;
  const draggedDateKey = taskListDateKey(draggedTask);
  return Boolean(draggedDateKey && draggedDateKey === taskListDateKey(targetTask));
}

function taskRowDropPosition(row: HTMLElement, event: DragEvent): TaskListDropPosition {
  const bounds = row.getBoundingClientRect?.();
  if (!bounds || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.height) || bounds.height <= 0 || event.clientY === undefined) {
    return "after";
  }
  return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

function setTaskRowDropClasses(row: HTMLElement, position: TaskListDropPosition): void {
  row.addClass("is-row-drop-target");
  row.toggleClass("is-drop-before", position === "before");
  row.toggleClass("is-drop-after", position === "after");
}

function clearTaskRowDropClasses(row: HTMLElement): void {
  row.removeClass("is-row-drop-target");
  row.removeClass("is-drop-before");
  row.removeClass("is-drop-after");
}

function isTaskListRescheduleBucket(bucket: DateBucket): boolean {
  return TASK_LIST_RESCHEDULE_BUCKETS.includes(bucket as (typeof TASK_LIST_RESCHEDULE_BUCKETS)[number]);
}

function taskListDropDateForBucket(bucket: DateBucket, now: Date): string | undefined {
  if (bucket === "overdue") return toLocalDateKey(addDays(now, -1));
  if (bucket === "today") return toLocalDateKey(now);
  if (bucket === "tomorrow") return toLocalDateKey(addDays(now, 1));
  if (bucket === "thisWeek") return toLocalDateKey(addDays(now, 2));
  return undefined;
}

function taskListDropTarget(task: TaskItem, dateKey: string): CalendarDropTarget {
  const startMinutes = startMinutesFromTask(task);
  return startMinutes === undefined ? dateKey : { dateKey, startMinutes };
}

function startMinutesFromTask(task: TaskItem): number | undefined {
  return taskScheduledStartMinutes(task);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function renderPlainTaskText(text: string): string {
  return text.replace(/\\([\\`*_[\]{}()#+\-.!|>])/g, "$1");
}

export function renderTaskDetails(
  container: HTMLElement,
  task: TaskItem | undefined,
  progressInfo: TaskProgressInfo | undefined,
  handlers: TaskRowHandlers,
  options: TaskRenderOptions,
  t: Translator
): void {
  container.empty();
  const details = container.createDiv({ cls: `task-hub-task-details ${task?.completed ? "is-completed" : ""}` });
  if (task) {
    const color = taskDisplayColor(task, options);
    if (color) setCssProps(details, { "--task-hub-source-color": color });
  }
  const header = details.createDiv({ cls: "task-hub-detail-header task-hub-detail-row task-hub-detail-title-header" });
  const headerIcon = header.createDiv({ cls: "task-hub-detail-icon-cell" });
  if (task) {
    const canHeaderToggle = task.source === "vault" || (task.source === "apple-reminders" && options.allowAppleReminderWriteback) || (task.source === "dida" && Boolean(options.allowDidaWriteback));
    renderTaskDetailCompleteCheckbox(headerIcon, task, canHeaderToggle, handlers, t);
  }
  header.createEl("h3", { cls: "task-hub-detail-label", text: t("taskDetails") });
  const headerLogo = header.createDiv({ cls: "task-hub-detail-header-logo-cell" });
  renderTaskDetailSourceLogo(headerLogo, task);
  header.createDiv({ cls: "task-hub-detail-control task-hub-detail-header-spacer" });
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
    const titleRow = detailRow(details, t("taskCreationBody"));
    titleRow.control.createDiv({ cls: `task-hub-detail-title ${task.completed ? "is-completed" : ""}`, text: task.text });
  }
  const facts = details.createDiv({ cls: "task-hub-detail-facts" });
  const plannedDate = taskPlannedDateKey(task);
  if (!canEditTask && plannedDate) renderReadonlyDetailValue(facts, t("date"), plannedDate);
  if (!canEditTask && task.tags.length > 0) renderReadonlyDetailValue(facts, t("tags"), task.tags.join(" "));
  if (!canEditTask) {
    renderReadonlyDetailValue(facts, t("sourceFile"), taskDetailSourceFileLabel(task), "task-hub-detail-source-file");
  }
  if (!canEditTask && task.contextPreview && !canEditExternalTask) {
    renderReadonlyDetailValue(facts, t("context"), task.contextPreview, "task-hub-detail-context");
  }

  let titleInput: HTMLTextAreaElement | undefined;
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
      titleInput = detailAutoGrowTextarea(
        editor,
        t("taskCreationBody"),
        task.text,
        "task-hub-detail-title-input"
      );
    }
    if (canEditTask) {
      dateInput = detailInput(editor, t("date"), plannedDate ?? "", "date");
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
      const toggleRow = detailRow(editor, t("editDetails"), (icon) => {
        detailsToggle = icon.createEl("input", { cls: "task-hub-detail-extra-toggle", type: "checkbox" }) as HTMLInputElement;
      });
      toggleRow.row.addClass("task-hub-detail-toggle-row");
      const extra = editor.createDiv({ cls: "task-hub-detail-extra is-hidden" });
      const toggle = detailsToggle;
      if (!toggle) throw new Error("Detail toggle failed to render.");
      toggle.addEventListener("change", () => {
        toggleDetailExtra(extra, toggle.checked);
      });
      const appleReminderLists = options.appleReminderLists ?? [];
      if (canEditAppleReminder && task.externalListId && appleReminderLists.length > 0) {
        const listSelect = detailSelect(
          extra,
          t("appleReminderList"),
          appleReminderLists.map((list) => ({ value: list.id, label: list.name })),
          task.externalListId,
          "task-hub-detail-list-select"
        );
        listSelect.addEventListener("change", () => {
          handlers.onAppleReminderListChange(task, listSelect.value);
        });
      } else {
        renderReadonlyDetailValue(extra, t("sourceFile"), taskDetailSourceFileLabel(task), "task-hub-detail-source-file");
      }
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
  const actionLanguageClass = t.isCjk ? "is-compact-language" : "is-long-language";
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

function renderTaskProgressRow(
  container: HTMLElement,
  progressInfo: TaskProgressInfo,
  previousProgressPercent?: number
): void {
  const progress = container.createDiv({ cls: "task-hub-task-progress" });
  const bar = progress.createDiv({ cls: "task-hub-task-progress-bar" });
  const fill = bar.createDiv({ cls: "task-hub-task-progress-fill" });
  progress.createSpan({ cls: "task-hub-task-progress-value", text: `${progressInfo.roundedPercent}%` });
  const nextPercent = clampTaskProgressPercent(progressInfo.roundedPercent);
  const shouldAnimate =
    typeof previousProgressPercent === "number"
    && previousProgressPercent !== nextPercent
    && !progress.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!shouldAnimate) {
    setCssStyles(fill, { width: `${nextPercent}%` });
    return;
  }

  const previousPercent = clampTaskProgressPercent(previousProgressPercent);
  progress.addClass("is-progress-animating");
  progress.addClass(nextPercent > previousPercent ? "is-progress-increasing" : "is-progress-decreasing");
  setCssStyles(fill, { width: `${previousPercent}%` });
  scheduleTaskProgressAnimation(progress, () => {
    setCssStyles(fill, { width: `${nextPercent}%` });
  });
  setTimeout(() => {
    progress.removeClass("is-progress-animating");
    progress.removeClass("is-progress-increasing");
    progress.removeClass("is-progress-decreasing");
  }, TASK_PROGRESS_ANIMATION_MS + 80);
}

function scheduleTaskProgressAnimation(element: HTMLElement, callback: () => void): void {
  const requestAnimationFrameFn = element.win.requestAnimationFrame?.bind(element.win);
  if (requestAnimationFrameFn) {
    requestAnimationFrameFn(() => callback());
    return;
  }
  setTimeout(callback, 0);
}

function clampTaskProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toggleDetailExtra(extra: HTMLElement, expanded: boolean): void {
  const reducedMotion = extra.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    extra.toggleClass("is-hidden", !expanded);
    extra.removeClass("is-expanding");
    extra.removeClass("is-opening");
    extra.removeClass("is-closing");
    setCssStyles(extra, { maxHeight: "" });
    return;
  }

  extra.addClass("is-expanding");

  if (expanded) {
    extra.addClass("is-opening");
    setCssStyles(extra, { maxHeight: "0px" });
    extra.removeClass("is-hidden");
    void extra.offsetHeight;
    extra.removeClass("is-opening");
    setCssStyles(extra, { maxHeight: `${extra.scrollHeight}px` });
    let finished = false;
    const finish = (event?: TransitionEvent) => {
      if (finished) return;
      if (event?.propertyName && event.propertyName !== "max-height") return;
      finished = true;
      extra.removeClass("is-expanding");
      setCssStyles(extra, { maxHeight: "" });
      extra.removeEventListener?.("transitionend", finish);
    };
    extra.addEventListener("transitionend", finish);
    setTimeout(() => finish(), 280);
    return;
  }

  setCssStyles(extra, { maxHeight: `${extra.scrollHeight}px` });
  void extra.offsetHeight;
  extra.addClass("is-closing");
  setCssStyles(extra, { maxHeight: "0px" });
  let finished = false;
  const finish = (event?: TransitionEvent) => {
    if (finished) return;
    if (event?.propertyName && event.propertyName !== "max-height") return;
    finished = true;
    extra.addClass("is-hidden");
    extra.removeClass("is-expanding");
    extra.removeClass("is-closing");
    setCssStyles(extra, { maxHeight: "" });
    extra.removeEventListener?.("transitionend", finish);
  };
  extra.addEventListener("transitionend", finish);
  setTimeout(() => finish(), 280);
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
  const select = container.createEl("select", { cls: "task-hub-send-target-select" }) as HTMLSelectElement;
  select.setAttr("aria-label", t("sendToTarget"));
  for (const option of options) {
    select.createEl("option", {
      value: option.value,
      text: option.label
    });
  }
  select.value = currentValue;
  select.addEventListener("change", () => {
    currentValue = select.value;
  });
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
  if (color) setCssProps(notesContainer, { "--task-hub-source-color": color });
  notesContainer.createEl("h4", { text: t("notes") });
  const canReorderNotes = notes.length > 1 && Boolean(handlers.onTaskNoteReorder);
  const notesByKey = new Map(notes.map((note) => [taskNoteOrderItemKey(note), note]));
  let activeDraggedNoteKey: string | undefined;
  for (const note of notes) {
    const text = taskNotePreviewBody(note.body);
    const noteKey = taskNoteOrderItemKey(note);
    const isPinned = options.isTaskNotePinned?.(task, note) ?? false;
    const card = notesContainer.createDiv({
      cls: `task-hub-task-note-card ${canReorderNotes ? "is-draggable" : ""} ${isPinned ? "is-pinned" : ""}`
    });
    if (canReorderNotes) {
      card.draggable = true;
      card.setAttr("draggable", "true");
      card.addEventListener("dragstart", (event) => {
        activeDraggedNoteKey = noteKey;
        card.addClass("is-dragging");
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(TASK_NOTE_DRAG_MIME, noteKey);
      });
      card.addEventListener("dragend", () => {
        activeDraggedNoteKey = undefined;
        card.removeClass("is-dragging");
        clearTaskNoteCardDropClasses(card);
      });
      card.addEventListener("dragover", (event) => {
        const draggedNote = taskNoteFromDragEvent(event, notesByKey, activeDraggedNoteKey);
        if (!draggedNote || draggedNote === note) return;
        const position = taskNoteCardDropPosition(card, event);
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        setTaskNoteCardDropClasses(card, position);
      });
      card.addEventListener("dragleave", () => {
        clearTaskNoteCardDropClasses(card);
      });
      card.addEventListener("drop", (event) => {
        const draggedNote = taskNoteFromDragEvent(event, notesByKey, activeDraggedNoteKey);
        activeDraggedNoteKey = undefined;
        card.removeClass("is-dragging");
        clearTaskNoteCardDropClasses(card);
        if (!draggedNote || draggedNote === note) return;
        const position = taskNoteCardDropPosition(card, event);
        event.preventDefault();
        handlers.onTaskNoteReorder?.(task, draggedNote, note, position);
      });
    }
    const pinButton = card.createEl("button", { cls: `task-hub-task-note-pin ${isPinned ? "is-active" : ""}` });
    pinButton.setAttr("aria-label", isPinned ? t("taskNoteUnpin") : t("taskNotePin"));
    pinButton.setAttr("title", isPinned ? t("taskNoteUnpin") : t("taskNotePin"));
    setIcon(pinButton, "pin");
    pinButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onToggleTaskNotePinned?.(task, note);
    });
    const menuButton = card.createEl("button", { cls: "task-hub-task-note-menu" });
    menuButton.setAttr("aria-label", t("more"));
    setIcon(menuButton, "more-horizontal");
    const openTaskNoteMenu = (event: MouseEvent) => {
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
      menu.addItem((item) => {
        item
          .setTitle(t("taskNoteEditSource"))
          .setIcon("file-text")
          .onClick(() => handlers.onOpenTaskNoteSource?.(note.path));
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
    };
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTaskNoteMenu(event as MouseEvent);
    });
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTaskNoteMenu(event as MouseEvent);
    });
    card.createDiv({ cls: "task-hub-task-note-title", text: taskNotePreviewTitle(note.path) });
    renderTaskNoteBody(card.createDiv({ cls: "task-hub-task-note-body" }), text, note.path, options.renderNoteMarkdown);
    if (note.createdAt) card.createDiv({ cls: "task-hub-task-note-date", text: note.createdAt.slice(0, 10) });
  }
}

function taskNoteFromDragEvent(
  event: DragEvent,
  notesByKey: ReadonlyMap<string, TaskNote>,
  activeDraggedNoteKey: string | undefined
): TaskNote | undefined {
  const draggedKey = activeDraggedNoteKey ?? event.dataTransfer?.getData(TASK_NOTE_DRAG_MIME);
  return draggedKey ? notesByKey.get(draggedKey) : undefined;
}

function taskNoteCardDropPosition(card: HTMLElement, event: DragEvent): TaskListDropPosition {
  const bounds = card.getBoundingClientRect?.();
  if (!bounds || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.height) || bounds.height <= 0 || event.clientY === undefined) {
    return "after";
  }
  return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

function setTaskNoteCardDropClasses(card: HTMLElement, position: TaskListDropPosition): void {
  card.addClass("is-note-drop-target");
  card.toggleClass("is-drop-before", position === "before");
  card.toggleClass("is-drop-after", position === "after");
}

function clearTaskNoteCardDropClasses(card: HTMLElement): void {
  card.removeClass("is-note-drop-target");
  card.removeClass("is-drop-before");
  card.removeClass("is-drop-after");
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

function detailAutoGrowTextarea(
  container: HTMLElement,
  label: string,
  value: string,
  textareaClass?: string
): HTMLTextAreaElement {
  const row = detailRow(container, label);
  const textarea = row.control.createEl("textarea", {
    cls: ["task-hub-auto-grow-textarea", textareaClass ?? ""].filter(Boolean).join(" ")
  }) as HTMLTextAreaElement;
  textarea.value = value;
  textarea.setAttr("rows", "1");
  resizeAutoGrowTextarea(textarea);
  textarea.addEventListener("input", () => resizeAutoGrowTextarea(textarea));
  return textarea;
}

function resizeAutoGrowTextarea(textarea: HTMLTextAreaElement): void {
  setCssStyles(textarea, { height: "auto" });
  const nextHeight = textarea.scrollHeight;
  if (Number.isFinite(nextHeight) && nextHeight > 0) {
    setCssStyles(textarea, { height: `${nextHeight}px` });
  }
}

function detailSelect(
  container: HTMLElement,
  label: string,
  options: Array<{ value: string; label: string }>,
  value: string,
  selectClass?: string
): HTMLSelectElement {
  const row = detailRow(container, label);
  const select = row.control.createEl("select", { cls: selectClass }) as HTMLSelectElement;
  for (const option of options) {
    const optionEl = select.createEl("option", { text: option.label }) as HTMLOptionElement;
    optionEl.value = option.value;
    optionEl.setAttr("value", option.value);
  }
  select.value = value;
  return select;
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

function tagChipEditor(
  container: HTMLElement,
  label: string,
  placeholder: string,
  initialTags: string[],
  bindTagInputSuggest?: (input: TaskHubTagInputElement) => void,
  onChange?: () => void
): TagChipEditor {
  const row = detailRow(container, label);
  row.row.addClass("task-hub-tag-editor-field");
  return createTagChipEditor(row.control, {
    label,
    placeholder,
    initialTags,
    bindTagInputSuggest,
    onChange
  });
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
