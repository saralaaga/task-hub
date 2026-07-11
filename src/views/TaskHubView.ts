import { type App, ItemView, MarkdownRenderer, Menu, Modal, Notice, WorkspaceLeaf } from "obsidian";
import { TASK_HUB_VIEW_TYPE } from "../constants";
import type { CalendarDropTarget } from "../calendar/calendarDropTarget";
import { toLocalDateKey } from "../calendar/dateBuckets";
import { filterTasks, type TaskFilterState } from "../filtering/filters";
import { applySmartListToTasks, materializeLegacySmartLists, smartListTaskReferences } from "../filtering/smartLists";
import { createTranslator } from "../i18n";
import type TaskHubPlugin from "../main";
import type { ExternalTaskListFilterEntry, TaskHubLastSessionState, TaskHubSettings, TaskHubSmartList, TaskItem } from "../types";
import { parseTasksFromMarkdown } from "../parsing/taskParser";
import { type CalendarViewMode } from "../calendar/calendarModel";
import { taskCompletedDateKey, taskPlannedDateKey, taskStartDateKey } from "../taskDates";
import { renderCalendarView, type AgendaScrollPosition, type CalendarModeTransitionDirection } from "./renderCalendarView";
import { renderShell, type DashboardView } from "./renderShell";
import { syncVisibleSources } from "./sourceVisibility";
import { renderSourceLogo } from "./sourceLogos";
import { renderTagsView } from "./renderTagsView";
import { renderTasksView } from "./renderTasksView";
import { renderDatedNotesView, type DatedNoteDayStats } from "./renderDatedNotesView";
import { decorateRenderedTaskNoteTags, renderPlainTaskNoteBody } from "./renderTaskNoteBody";
import { bindTaskHubTagInputSuggest, collectObsidianTags, type TaskHubTagInputElement } from "./tagInputSuggest";
import type { DatedNote } from "../datedNotes";

type TaskHubRenderOptions = {
  preserveTaskListScroll?: boolean;
  preserveContentScroll?: boolean;
  preserveCalendarAgendaScroll?: boolean;
};

type ViewportRestoreHandle = {
  kind: "animationFrame" | "timeout";
  id: number;
};

export class TaskHubView extends ItemView {
  private view: DashboardView;
  private filters: TaskFilterState;
  private calendarMode: CalendarViewMode;
  private calendarModeTransition: CalendarModeTransitionDirection | undefined;
  private calendarFocusDate: Date;
  private visibleSourceIds: Set<string>;
  private knownCalendarSourceIds = new Set<string>(["vault"]);
  private isRefreshing = false;
  private selectedTaskId: string | undefined;
  private selectedTaskStableId: string | undefined;
  private taskListScrollTop = 0;
  private smartListScrollTop = 0;
  private externalListScrollTop = 0;
  private contentScrollTop = 0;
  private calendarAgendaScrollPosition: AgendaScrollPosition | undefined;
  private calendarDaySidebarScrollTop = 0;
  private completingTaskIds = new Set<string>();
  private selectedTaskIds = new Set<string>();
  private unscheduledPanelOpen: boolean;
  private unscheduledPanelOpening = false;
  private unscheduledPanelClosing = false;
  private unscheduledPanelCloseTimer: number | undefined;
  private expandedTaskIds = new Set<string>();
  private expandingTaskIds = new Set<string>();
  private activeSmartListId: string | undefined;
  private selectedExternalListFilterId: string | undefined;
  private selectedDatedNotePath: string | undefined;
  private datedNoteQuery = "";
  private pendingDatedNoteDetailScroll = false;
  private pendingDatedNoteDetailTransition = false;
  private lastRenderedDashboardView: DashboardView | undefined;
  private lastTaskViewTransitionKey: string | undefined;
  private pendingExpandedTaskScrollId: string | undefined;
  private pendingExpandedTaskScrollTimers: number[] = [];
  private pendingViewportRestoreHandles: ViewportRestoreHandle[] = [];
  private readonly undoShortcutHandler = (event: KeyboardEvent) => {
    if (!shouldHandleTaskHubUndoShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
    void this.plugin.undoLastTaskChange();
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskHubPlugin
  ) {
    super(leaf);
    const restoredState = restoreTaskHubSessionState(this.plugin.settings);
    this.view = restoredState.view;
    this.filters = restoredState.filters;
    this.calendarMode = restoredState.calendarMode;
    this.calendarFocusDate = restoredState.calendarFocusDate;
    this.visibleSourceIds = restoredState.visibleSourceIds;
    this.unscheduledPanelOpen = restoredState.unscheduledPanelOpen;
    this.selectedExternalListFilterId = restoredState.selectedExternalListFilterId;
    const currentSourceIds =
      typeof this.plugin.getCalendarSources === "function"
        ? this.plugin.getCalendarSources().map((source) => source.id)
        : [];
    this.knownCalendarSourceIds = new Set(["vault", ...currentSourceIds]);
  }

  getViewType(): string {
    return TASK_HUB_VIEW_TYPE;
  }

  getDisplayText(): string {
    return createTranslator(this.plugin.settings.language)("taskHub");
  }

  onOpen(): Promise<void> {
    this.containerEl.addEventListener("keydown", this.undoShortcutHandler);
    this.render({ preserveTaskListScroll: true });
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.containerEl.removeEventListener("keydown", this.undoShortcutHandler);
    this.clearPendingViewportRestores();
    this.syncSessionStateToSettings();
    return this.plugin.saveData(this.plugin.settings);
  }

  render(options: TaskHubRenderOptions = {}): void {
    if (shouldPreserveScroll(options)) {
      this.captureTaskListScroll();
      this.captureTaskSidebarScrolls();
      this.captureContentScroll();
      this.captureCalendarAgendaScroll();
      this.captureCalendarDaySidebarScroll();
    }
    const container = this.containerEl.children[1] as HTMLElement;
    const baseTasks = this.plugin.getTasks();
    const allTasks = this.withLinkedNoteSubtasks(baseTasks);
    const now = new Date();
    if (this.view === "notes" && !this.plugin.settings.datedNotes.enabled) {
      this.view = "tasks";
    }
    const unscheduledTasks = collectUnscheduledTasks(allTasks, this.filters, now, (task) => this.canScheduleTask(task));
    const calendarUnscheduledTasks = collectCalendarUnscheduledTasks(
      allTasks,
      this.filters,
      now,
      (task) => this.canScheduleTask(task),
      this.completingTaskIds
    );
    const calendarSources = this.plugin.getCalendarSources();
    const calendarSourceIds = ["vault", ...calendarSources.map((source) => source.id)];
    syncVisibleSources(this.visibleSourceIds, this.knownCalendarSourceIds, calendarSourceIds);
    const t = createTranslator(this.plugin.settings.language);
    const sourceColors = {
      vault: "var(--interactive-accent)",
      "apple-reminders": this.plugin.settings.localApple.remindersColor,
      dida: this.plugin.settings.dida.tasksColor
    };
    const taskColors = {
      ...this.plugin.getAppleReminderListColors(),
      ...this.plugin.getDidaProjectColors()
    };
    const allExternalTaskListEntries = this.externalTaskListEntries(allTasks, this.filters.status !== "open");
    const externalTaskListEntries = this.visibleExternalTaskListEntries(allExternalTaskListEntries);
    this.reconcileExternalListFilterSelection(externalTaskListEntries);
    const bindTagInputSuggest = (input: TaskHubTagInputElement) => {
      bindTaskHubTagInputSuggest(this.plugin.app, input, () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()));
    };
    const sourceFilters = taskSourceFilterOptions(allTasks, this.filters, new Date(), t);
    const renderedDashboardView = this.view;
    const animateViewTransition = this.lastRenderedDashboardView !== undefined && this.lastRenderedDashboardView !== renderedDashboardView;
    const shellFilters = this.view === "notes" ? { ...this.filters, textQuery: this.datedNoteQuery } : this.filters;
    const main = renderShell(
      container,
      {
        view: this.view,
        filters: shellFilters,
        availableTags: collectTags(allTasks),
        sourceFilters,
        stats: this.plugin.taskIndex.getStats(),
        isRefreshing: this.isRefreshing,
        unscheduledPanelOpen: this.view === "calendar" && this.unscheduledPanelOpen,
        unscheduledTaskCount: unscheduledTasks.length,
        animateViewTransition,
        datedNotesEnabled: this.plugin.settings.datedNotes.enabled,
        t
      },
      {
        onViewChange: (view) => {
          this.view = view;
          this.persistSessionState();
          this.render();
        },
        onRescan: () => void this.refreshData(),
        onCreateTask: () => this.openCreateTaskFromToolbar(),
        onUnscheduledToggle: () => {
          if (this.view !== "calendar") {
            this.openUnscheduledPanel();
            this.view = "calendar";
          } else {
            this.toggleUnscheduledPanel();
          }
          this.persistSessionState();
          this.render();
        },
        onStatusChange: (status) => {
          this.updateFilters({ ...this.filters, status }, {}, { keepActiveSmartList: true });
        },
        onConditionChange: (conditions) => {
          this.updateFilters({ ...this.filters, conditions });
        },
        onClearFilters: () => {
          this.selectedExternalListFilterId = undefined;
          this.updateFilters(clearTaskViewFilters(this.filters), { preserveTaskListScroll: true });
        },
        onTagQueryChange: (tagQuery) => {
          this.updateFilters({ ...this.filters, tagQuery }, { preserveTaskListScroll: true });
        },
        onSourceFilterChange: (source) => {
          this.updateFilters({ ...this.filters, sourceQuery: source === "all" ? "" : source });
        },
        onTextQueryChange: (textQuery) => {
          if (this.view === "notes") {
            this.datedNoteQuery = textQuery;
            this.render({ preserveContentScroll: true });
            return;
          }
          this.updateFilters({ ...this.filters, textQuery });
        }
      },
      { bindTagInputSuggest }
    );
    this.lastRenderedDashboardView = renderedDashboardView;

    if (this.view === "notes") {
      const datedNotes = this.plugin.getDatedNotes();
      const datedNoteDayStats = buildDatedNoteDayStats(baseTasks, datedNotes.map((note) => note.date));
      renderDatedNotesView(
        main,
        datedNotes,
        {
          selectedPath: this.selectedDatedNotePath,
          query: this.datedNoteQuery,
          t,
          animateDetailTransition: this.pendingDatedNoteDetailTransition,
          dayStatsByDate: datedNoteDayStats
        },
        {
          onSelectNote: (note) => {
            if (this.selectedDatedNotePath === note.path) return;
            this.selectedDatedNotePath = note.path;
            this.pendingDatedNoteDetailScroll = true;
            this.pendingDatedNoteDetailTransition = true;
            this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
          },
          onOpenNoteSource: (path) => void this.plugin.openDatedNoteSource(path),
          onOpenNoteActions: (note, event) => this.openDatedNoteActionsMenu(note, event)
        },
        {
          renderNoteMarkdown: (noteContainer, body, sourcePath) => this.renderNoteMarkdown(noteContainer, body, sourcePath)
        }
      );
      this.restoreContentScroll(options);
      if (this.pendingDatedNoteDetailScroll) {
        scrollDatedNoteDetailToTop(main);
        this.pendingDatedNoteDetailScroll = false;
      }
      this.pendingDatedNoteDetailTransition = false;
      this.scheduleViewportRestore(options);
      return;
    }

    if (this.view === "tasks") {
      const now = new Date();
      this.migrateLegacySmartLists(allTasks, now);
      const smartLists = this.plugin.settings.smartLists;
      const taskViewTransitionKey = buildTaskViewTransitionKey(
        this.filters,
        this.activeSmartListId,
        this.selectedExternalListFilterId
      );
      const shouldAnimateTaskList =
        this.lastTaskViewTransitionKey !== undefined &&
        this.lastTaskViewTransitionKey !== taskViewTransitionKey;
      this.lastTaskViewTransitionKey = taskViewTransitionKey;
      const visibleTasks = this.taskViewVisibleTasks(allTasks, now, externalTaskListEntries);
      const selection = reconcileVisibleTaskSelection(
        visibleTasks,
        this.selectedTaskId,
        this.selectedTaskStableId,
        this.selectedTaskIds
      );
      this.selectedTaskId = selection.selectedTaskId;
      this.selectedTaskStableId = selection.selectedTaskStableId;
      this.selectedTaskIds = selection.selectedTaskIds;
      renderTasksView(
        main,
        visibleTasks,
        allTasks,
        this.filters,
        {
          onComplete: (task) => void this.completeTaskFromView(task),
          onJump: (task) => void this.plugin.jumpToTask(task),
          onSendToAppleReminders: (task) => void this.plugin.sendTaskToAppleReminders(task),
          onSendToDida: (task) => void this.plugin.sendTaskToDida(task),
          onSendToAppleCalendar: (task) => void this.plugin.convertAppleReminderToCalendarEvent(task),
          onSelect: (task, intent) => this.updateTaskSelection(task, intent?.selectedTaskIds),
          onTagSelect: (tag) => {
            this.updateFilters({
              ...this.filters,
              tagQuery: this.filters.tagQuery === tag ? "" : tag
            }, { preserveTaskListScroll: true });
          },
          onSourceSelect: (source) => {
            this.updateFilters({ ...this.filters, sourceQuery: source === "all" ? "" : source });
          },
          onAppleReminderListChange: (task, listId) => void this.plugin.moveAppleReminderToList(task, listId),
          onDidaProjectChange: (task, projectId) => void this.plugin.moveDidaTaskToProject(task, projectId),
          onTaskReschedule: (task, target) => {
            this.captureTaskListScroll();
            this.captureContentScroll();
            void this.plugin.rescheduleTask(task, target);
          },
          onTaskReorder: (task, anchorTask, position) => {
            this.captureTaskListScroll();
            this.captureContentScroll();
            void this.plugin.reorderTaskListDate(task, anchorTask, position);
          },
          onTaskUpdate: (task, draft) => void this.plugin.updateCalendarTask(task, draft),
          onTaskDelete: (task) => void this.plugin.deleteCalendarTask(task),
          onCreateTaskForDate: (target) => this.openCreateTaskForDate(target),
          onSendToTarget: (task, target) => void this.plugin.sendTaskToTarget(task, target),
          onCreateTaskNote: (task) => void this.plugin.createTaskNoteForTask(task),
          onOpenTaskNote: (path) => void this.plugin.openTaskNote(path),
          onDeleteTaskNote: (path) => void this.plugin.deleteTaskNote(path),
          onOpenTaskNoteSource: (path) => void this.plugin.openTaskNoteSource(path),
          onOpenTaskNoteInThino: (path) => void this.plugin.openTaskNoteSource(path),
          onTaskNoteReorder: (task, draggedNote, anchorNote, position) => {
            this.captureContentScroll();
            void this.plugin.reorderTaskNotes(task, draggedNote, anchorNote, position);
          },
          onToggleTaskNotePinned: (task, note) => {
            this.captureContentScroll();
            void this.plugin.toggleTaskNotePinned(task, note);
          }
        },
        now,
        t,
        {
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.canCreateAppleReminders(),
          allowDidaWriteback: this.plugin.settings.dida.tasksWritebackEnabled,
          allowDidaDragReschedule: this.plugin.settings.dida.tasksDragRescheduleEnabled,
          allowDidaCreate: this.plugin.canCreateDidaTasks(),
          allowDidaDelete: this.plugin.settings.dida.tasksDeleteEnabled,
          allowAppleCalendarReminderConversion:
            this.plugin.settings.localApple.calendarReminderConversionEnabled && this.plugin.canConvertAppleCalendarAndReminders(),
          showSubtaskProgressBars: this.plugin.settings.showSubtaskProgressBars,
          appleReminderLists: this.plugin.getAppleReminderLists(),
          didaProjects: this.plugin.getDidaProjects(),
          taskSendDefaultTarget: this.plugin.defaultTaskSendTarget(),
          selectedTaskId: this.selectedTaskId,
          selectedTaskIds: this.selectedTaskIds,
          expandedTaskIds: this.expandedTaskIds,
          expandingTaskIds: this.expandingTaskIds,
          sourceColors,
          taskColors,
          bindTagInputSuggest,
          taskListScrollTop: this.taskListScrollTop,
          smartListScrollTop: this.smartListScrollTop,
          externalListScrollTop: this.externalListScrollTop,
          taskListManualOrder: this.plugin.settings.taskListManualOrder,
          animateTaskListTransition: shouldAnimateTaskList,
          availableTags: collectTags(allTasks),
          sourceFilters,
          filterHandlers: {
            onConditionChange: (conditions) => {
              this.updateFilters({ ...this.filters, conditions });
            },
            onClearFilters: () => {
              this.selectedExternalListFilterId = undefined;
              this.updateFilters(clearTaskViewFilters(this.filters), { preserveTaskListScroll: true });
            },
            onTagQueryChange: (tagQuery) => {
              this.updateFilters({ ...this.filters, tagQuery }, { preserveTaskListScroll: true });
            },
            onSourceFilterChange: (source) => {
              this.updateFilters({ ...this.filters, sourceQuery: source === "all" ? "" : source });
            },
            onTextQueryChange: (textQuery) => {
              this.updateFilters({ ...this.filters, textQuery });
            }
          },
          smartLists,
          smartListCounts: smartListCountsForTasks(allTasks, smartLists, now, this.filters.status),
          activeSmartListId: this.activeSmartListId,
          externalListEntries: externalTaskListEntries,
          showExternalListCard: allExternalTaskListEntries.length > 0,
          activeExternalListFilterId: this.selectedExternalListFilterId,
          onSaveSmartList: (name) => this.saveSmartList(visibleTasks, name),
          onApplySmartList: (smartList) => this.applySmartList(smartList, allTasks),
          onToggleExternalListFilter: (entry) => this.toggleExternalListFilter(entry),
          onConfigureExternalLists: () => this.openExternalListVisibilityModal(allExternalTaskListEntries),
          onAddTasksToSmartList: (smartList, tasks) => this.addTasksToSmartList(smartList, tasks, allTasks),
          onAddTasksToExternalList: (entry, tasks) => void this.addTasksToExternalList(entry, tasks),
          onRemoveTasksFromActiveSmartList: (tasks) => this.removeTasksFromActiveSmartList(tasks),
          onDeleteSmartList: (smartList) => this.deleteSmartList(smartList),
          onRenameSmartList: (smartList, name) => this.renameSmartList(smartList, name),
          onSmartListColorChange: (smartList, color) => this.updateSmartListColor(smartList, color),
          exitingTaskIds: this.exitingTaskIds(allTasks),
          taskNotesEnabled: this.plugin.settings.taskNotes.enabled,
          allowThinoNoteEdit: this.plugin.settings.taskNotes.thinoIntegrationEnabled,
          getTaskNoteCount: (task) =>
            this.plugin.settings.taskNotes.showCountsInTaskList ? this.plugin.getTaskNoteCount(task) : 0,
          getTaskNotes: (task) => this.plugin.getOrderedTaskNotes(task),
          isTaskNotePinned: (task, note) => this.plugin.isTaskNotePinned(task, note),
          onToggleTaskExpanded: (task) => {
            const isExpanding = !this.expandedTaskIds.has(task.id);
            this.expandedTaskIds = toggleSetValue(this.expandedTaskIds, task.id);
            this.expandingTaskIds = isExpanding ? new Set([task.id]) : new Set();
            this.pendingExpandedTaskScrollId = isExpanding ? task.id : undefined;
            this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
          },
          renderNoteMarkdown: (noteContainer, body, sourcePath) => this.renderNoteMarkdown(noteContainer, body, sourcePath)
        }
      );
      this.restoreContentScroll(options);
      if (this.pendingExpandedTaskScrollId) {
        this.scheduleExpandedTaskScroll(this.pendingExpandedTaskScrollId);
        this.pendingExpandedTaskScrollId = undefined;
      }
      if (this.expandingTaskIds.size > 0) {
        this.expandingTaskIds = new Set();
      }
      this.scheduleViewportRestore(options);
      return;
    }

    if (this.view === "tags") {
      const visibleTagTasks = this.filters.status === "open" ? allTasks.filter((task) => !task.completed) : allTasks;
      renderTagsView(
        main,
        visibleTagTasks,
        {
          onTagSelect: (tag) => {
            this.view = "tasks";
            this.updateFilters({ ...this.filters, tagQuery: tag });
          },
          onTaskComplete: (task) => void this.completeTaskFromView(task),
          onTaskSelect: (task) => {
            this.view = "tasks";
            this.selectedTaskId = task.id;
            this.selectedTaskIds = new Set([task.id]);
            this.updateFilters({ ...this.filters, tagQuery: "" });
          },
          onTaskJump: (task) => void this.plugin.jumpToTask(task),
          onTaskDelete: (task) => void this.plugin.deleteCalendarTask(task),
          onSendToAppleReminders: (task) => void this.plugin.sendTaskToAppleReminders(task),
          onSendToDida: (task) => void this.plugin.sendTaskToDida(task),
          onSendToAppleCalendar: (task) => void this.plugin.convertAppleReminderToCalendarEvent(task),
          onCreateTaskNote: (task) => void this.plugin.createTaskNoteForTask(task),
          onReorderTags: (sourceTag, targetTag) => {
            void this.reorderTagCards(sourceTag, targetTag);
          }
        },
        t,
        {
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.canCreateAppleReminders(),
          allowDidaWriteback: this.plugin.settings.dida.tasksWritebackEnabled,
          allowDidaCreate: this.plugin.canCreateDidaTasks(),
          allowDidaDelete: this.plugin.settings.dida.tasksDeleteEnabled,
          allowAppleCalendarReminderConversion:
            this.plugin.settings.localApple.calendarReminderConversionEnabled && this.plugin.canConvertAppleCalendarAndReminders(),
          taskNotesEnabled: this.plugin.settings.taskNotes.enabled,
          orderedTags: this.plugin.settings.tagViewOrder,
          sourceColors,
          taskColors
        }
      );
      this.restoreContentScroll(options);
      this.scheduleViewportRestore(options);
      return;
    }

    if (this.view === "calendar") {
      renderCalendarView(
        main,
        {
          mode: this.calendarMode,
          modeTransition: this.calendarModeTransition,
          focusDate: this.calendarFocusDate,
          weekStart: this.plugin.settings.weekStart,
          visibleSourceIds: this.visibleSourceIds,
          includeCompletedTasks: this.filters.status !== "open",
          localAppleEnabled: this.plugin.settings.localApple.enabled,
          localAppleSupported: this.plugin.isLocalAppleSupported(),
          localAppleRemindersEnabled: this.plugin.settings.localApple.remindersEnabled,
          localAppleCalendarEnabled: this.plugin.settings.localApple.calendarEnabled,
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.canCreateAppleReminders(),
          allowDidaWriteback: this.plugin.settings.dida.tasksWritebackEnabled,
          allowDidaDragReschedule: this.plugin.settings.dida.tasksDragRescheduleEnabled,
          allowDidaDelete: this.plugin.settings.dida.tasksDeleteEnabled,
          allowDidaCreate: this.plugin.canCreateDidaTasks(),
          allowAppleCalendarWriteback: this.plugin.settings.localApple.calendarWritebackEnabled,
          allowAppleCalendarReminderConversion:
            this.plugin.settings.localApple.calendarReminderConversionEnabled && this.plugin.canConvertAppleCalendarAndReminders(),
          allowTaskCreation: this.plugin.settings.calendarTaskCreationEnabled,
          showLunarCalendar: this.plugin.settings.language === "zh" && this.plugin.settings.showLunarCalendar,
          calendarTimeScale: this.plugin.settings.calendarTimeScale,
          calendarDayStartHour: this.plugin.settings.calendarDayStartHour,
          calendarDayEndHour: this.plugin.settings.calendarDayEndHour,
          calendarAgendaScrollPosition: shouldPreserveScroll(options) ? this.calendarAgendaScrollPosition : undefined,
          defaultTimedTaskDurationMinutes: this.plugin.settings.localApple.calendarDefaultTimedTaskDurationMinutes,
          taskDurationOverrides: this.plugin.settings.localApple.reminderDurationOverrides,
          taskColors,
          bindTagInputSuggest,
          appleReminderLists: this.plugin.getAppleReminderLists(),
          didaProjects: this.plugin.getDidaProjects(),
          taskSendDefaultTarget: this.plugin.defaultTaskSendTarget(),
          appleCalendars: this.plugin.getAppleCalendars(),
          sources: calendarSources,
          taskNotesEnabled: this.plugin.settings.taskNotes.enabled,
          selectedTaskIds: this.selectedTaskIds,
          completingTaskIds: this.completingTaskIds,
          unscheduledPanelOpen: this.unscheduledPanelOpen,
          unscheduledPanelOpening: this.unscheduledPanelOpening,
          unscheduledPanelClosing: this.unscheduledPanelClosing,
          unscheduledTasks: calendarUnscheduledTasks,
          allowThinoNoteEdit: this.plugin.settings.taskNotes.thinoIntegrationEnabled,
          getTaskNotes: (task) => this.plugin.getTaskNotes(task),
          getEventNotes: (event) => this.plugin.getEventNotes(event),
          renderNoteMarkdown: (noteContainer, body, sourcePath) => this.renderNoteMarkdown(noteContainer, body, sourcePath),
          t
        },
        allTasks,
        this.plugin.getCalendarEvents(),
        {
          onModeChange: (mode) => {
            this.calendarModeTransition = calendarModeTransitionDirection(this.calendarMode, mode);
            this.calendarMode = mode;
            this.persistSessionState();
            this.render();
          },
          onMove: (direction) => {
            this.calendarFocusDate = moveDate(this.calendarFocusDate, this.calendarMode, direction);
            this.persistSessionState();
            this.render();
          },
          onToday: () => {
            this.calendarFocusDate = new Date();
            this.persistSessionState();
            this.render();
          },
          onFocusDateChange: (date) => {
            this.calendarFocusDate = date;
            this.persistSessionState();
            this.render();
          },
          onTimeScaleChange: (scale) => {
            this.plugin.settings.calendarTimeScale = scale;
            void this.plugin.saveSettings().then(() => this.render());
          },
          onLayerToggle: (sourceId) => {
            this.visibleSourceIds = toggleSetValue(this.visibleSourceIds, sourceId);
            this.persistSessionState();
            this.render();
          },
          onDateCreateTask: (target) => this.openCreateTaskForDate(target),
          onTaskComplete: (task) => void this.completeTaskFromView(task),
          onTaskJump: (task) => void this.plugin.jumpToTask(task),
          onTaskSelect: (task) => {
            this.updateTaskSelection(task);
            this.render();
          },
          onTaskSelectionChange: (task, taskIds) => {
            this.updateTaskSelection(task, taskIds);
          },
          onTaskUpdate: (task, draft) => void this.withPreservedCalendarViewport(() => this.plugin.updateCalendarTask(task, draft)),
          onTaskReschedule: (task, dateKey) => void this.withPreservedCalendarViewport(() => this.plugin.rescheduleTask(task, dateKey)),
          onTaskDelete: (task) => void this.withPreservedCalendarViewport(() => this.plugin.deleteCalendarTask(task)),
          onTaskSendToTarget: (task, target) => void this.withPreservedCalendarViewport(() => this.plugin.sendTaskToTarget(task, target)),
          onTaskSendToAppleReminders: (task) => void this.withPreservedCalendarViewport(() => this.plugin.sendTaskToAppleReminders(task)),
          onTaskSendToDida: (task) => void this.withPreservedCalendarViewport(() => this.plugin.sendTaskToDida(task)),
          onTaskSendToAppleCalendar: (task) => void this.withPreservedCalendarViewport(() => this.plugin.convertAppleReminderToCalendarEvent(task)),
          onAppleReminderListChange: (task, listId) => void this.withPreservedCalendarViewport(() => this.plugin.moveAppleReminderToList(task, listId)),
          onEventReschedule: (event, dateKey) => void this.withPreservedCalendarViewport(() => this.plugin.rescheduleCalendarEvent(event, dateKey)),
          onEventUpdate: (event, draft) => void this.withPreservedCalendarViewport(() => this.plugin.updateCalendarEvent(event, draft)),
          onEventDelete: (event) => void this.withPreservedCalendarViewport(() => this.plugin.deleteCalendarEvent(event)),
          onEventSendToAppleReminders: (event) => void this.withPreservedCalendarViewport(() => this.plugin.convertAppleCalendarEventToReminder(event)),
          onCreateTaskNote: (task) => void this.plugin.createTaskNoteForTask(task),
          onCreateEventNote: (event) => void this.plugin.createTaskNoteForEvent(event),
          onOpenTaskNote: (path) => void this.plugin.openTaskNote(path),
          onDeleteTaskNote: (path) => void this.plugin.deleteTaskNote(path),
          onOpenTaskNoteSource: (path) => void this.plugin.openTaskNoteSource(path),
          onOpenTaskNoteInThino: (path) => void this.plugin.openTaskNoteSource(path),
          onTaskNoteReorder: (task, draggedNote, anchorNote, position) => {
            this.captureContentScroll();
            void this.plugin.reorderTaskNotes(task, draggedNote, anchorNote, position);
          },
          onToggleTaskNotePinned: (task, note) => {
            this.captureContentScroll();
            void this.plugin.toggleTaskNotePinned(task, note);
          }
        }
      );
      this.unscheduledPanelOpening = false;
      this.calendarModeTransition = undefined;
      this.restoreContentScroll(options);
      this.scheduleViewportRestore(options);
      return;
    }

  }

  private toggleUnscheduledPanel(): void {
    if (this.unscheduledPanelOpen) {
      this.closeUnscheduledPanelWithAnimation();
      return;
    }
    this.openUnscheduledPanel();
  }

  private openUnscheduledPanel(): void {
    if (this.unscheduledPanelCloseTimer) {
      this.containerEl.win.clearTimeout(this.unscheduledPanelCloseTimer);
      this.unscheduledPanelCloseTimer = undefined;
    }
    const wasOpen = this.unscheduledPanelOpen;
    this.unscheduledPanelOpen = true;
    this.unscheduledPanelOpening = !wasOpen;
    this.unscheduledPanelClosing = false;
  }

  private closeUnscheduledPanelWithAnimation(): void {
    if (this.unscheduledPanelCloseTimer) this.containerEl.win.clearTimeout(this.unscheduledPanelCloseTimer);
    this.unscheduledPanelOpen = false;
    this.unscheduledPanelOpening = false;
    this.unscheduledPanelClosing = true;
    this.unscheduledPanelCloseTimer = this.containerEl.win.setTimeout(() => {
      this.unscheduledPanelCloseTimer = undefined;
      if (!this.unscheduledPanelClosing) return;
      this.unscheduledPanelClosing = false;
      this.render({ preserveTaskListScroll: true });
    }, 220);
  }

  private async refreshData(): Promise<void> {
    if (this.isRefreshing) return;
    if (this.filters.tagQuery) {
      this.filters = cloneTaskFilters({ ...this.filters, tagQuery: "" });
      this.syncSessionStateToSettings();
      void this.plugin.saveSettings();
    }
    this.isRefreshing = true;
    this.render({ preserveTaskListScroll: true });
    try {
      await this.plugin.scanVault();
      new Notice(createTranslator(this.plugin.settings.language)("rescanComplete"));
    } catch (error) {
      new Notice(`${createTranslator(this.plugin.settings.language)("rescanFailed")}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRefreshing = false;
      this.render({ preserveTaskListScroll: true });
    }
  }

  private openCreateTaskFromToolbar(): void {
    const activeSmartList = this.activeSmartList();
    this.plugin.openCreateTaskModal(toLocalDateKey(new Date()), {
      allowDatedNote: this.plugin.settings.datedNotes?.enabled === true,
      initialKind: this.view === "notes" && this.plugin.settings.datedNotes?.enabled === true ? "note" : undefined,
      onDatedNoteCreated: (note) => {
        this.view = "notes";
        this.selectedDatedNotePath = note.path;
        this.datedNoteQuery = "";
        this.persistSessionState();
        this.render({ preserveContentScroll: true });
      },
      ...(activeSmartList
        ? {
            onTaskCreated: (task) => this.addTasksToSmartList(activeSmartList, [task])
          }
        : {})
    });
  }

  private openDatedNoteActionsMenu(note: DatedNote, event: MouseEvent): void {
    const t = createTranslator(this.plugin.settings.language);
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle(t("edit")).onClick(() => void this.plugin.openDatedNoteEditor(note.path));
    });
    menu.addItem((item) => {
      item.setTitle(t("openSource")).onClick(() => void this.plugin.openDatedNoteSource(note.path));
    });
    menu.addItem((item) => {
      item.setTitle(t("delete")).onClick(() => void this.plugin.deleteDatedNote(note.path));
    });
    menu.showAtMouseEvent(event);
  }

  private openCreateTaskForDate(target: CalendarDropTarget): void {
    const activeSmartList = this.activeSmartList();
    this.plugin.openCreateTaskModal(target, {
      ...(activeSmartList
        ? {
            onTaskCreated: (task) => this.addTasksToSmartList(activeSmartList, [task])
          }
        : {})
    });
  }

  private renderNoteMarkdown(container: HTMLElement, body: string, sourcePath: string): void {
    container.empty();
    void MarkdownRenderer.render(this.app, body, container, sourcePath, this)
      .then(() => decorateRenderedTaskNoteTags(container))
      .catch(() => {
        container.empty();
        renderPlainTaskNoteBody(container, body);
      });
  }

  private captureTaskListScroll(): void {
    if (this.view !== "tasks") return;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const list = container ? findTaskListPane(container) : undefined;
    this.taskListScrollTop = list?.scrollTop ?? this.taskListScrollTop;
  }

  private captureTaskSidebarScrolls(): void {
    if (this.view !== "tasks") return;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const smartList = container?.querySelector<HTMLElement>(".task-hub-smart-list-items");
    const externalList = container?.querySelector<HTMLElement>(".task-hub-external-list-items");
    this.smartListScrollTop = smartList?.scrollTop ?? this.smartListScrollTop;
    this.externalListScrollTop = externalList?.scrollTop ?? this.externalListScrollTop;
  }

  private taskViewVisibleTasks(
    allTasks: TaskItem[],
    now: Date,
    externalTaskListEntries: ExternalTaskListFilterEntry[] = this.externalTaskListEntries()
  ): TaskItem[] {
    const activeSmartList = this.activeSmartList();
    const visibleTasks = this.applyExternalListFilter(
      activeSmartList
        ? filterTasksByStatus(applySmartListToTasks(allTasks, activeSmartList, now), this.filters.status)
        : filterTasks(allTasks, this.filters, now),
      externalTaskListEntries
    );
    if (this.filters.status !== "open" || this.completingTaskIds.size === 0) {
      return visibleTasks;
    }

    const activeExternalListFilter = this.activeExternalListFilterEntry(externalTaskListEntries);
    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    const exitingTasks = allTasks.filter((task) => {
      if (!this.completingTaskIds.has(task.id) || visibleIds.has(task.id) || !task.completed) return false;
      if (!this.taskMatchesExternalListFilter(task, activeExternalListFilter)) return false;
      if (!activeSmartList) return filterTasks([task], { ...this.filters, status: "all" }, now).length > 0;
      return applySmartListToTasks([task], activeSmartList, now).length > 0;
    });
    return [...visibleTasks, ...exitingTasks];
  }

  private saveSmartList(tasks: TaskItem[], name: string): void {
    const t = createTranslator(this.plugin.settings.language);
    const smartList = buildSavedSmartList({
      existingSmartLists: this.plugin.settings.smartLists,
      name,
      tasks,
      now: new Date()
    });
    if (!smartList) return;
    this.plugin.settings.smartLists = [...this.plugin.settings.smartLists, smartList];
    this.activeSmartListId = smartList.id;
    void this.plugin.saveSettings().then(() => {
      new Notice(t("smartListSaved"));
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private applySmartList(smartList: TaskHubSmartList, allTasks: TaskItem[]): void {
    if (this.activeSmartListId === smartList.id) {
      this.clearActiveSmartListState();
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
      return;
    }
    this.activeSmartListId = smartList.id;
    this.selectedTaskIds = new Set();
    this.selectedTaskId = undefined;
    this.selectedTaskStableId = undefined;
    this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
  }

  private addTasksToSmartList(smartList: TaskHubSmartList, tasks: TaskItem[], allTasks?: TaskItem[]): void {
    if (tasks.length === 0) return;
    const taskTree = allTasks ?? (typeof this.plugin.getTasks === "function" ? this.plugin.getTasks() : tasks);
    const expandedTasks = tasksWithDescendants(taskTree, tasks);
    const now = new Date().toISOString();
    let changed = false;
    this.plugin.settings.smartLists = this.plugin.settings.smartLists.map((item) => {
      if (item.id !== smartList.id) return item;
      const references = mergeSmartListTaskReferences(item, expandedTasks);
      if (smartListReferencesEqual(item, references)) {
        return item;
      }
      changed = true;
      return {
        ...item,
        ...references,
        updatedAt: now
      };
    });
    if (!changed) return;
    void this.plugin.saveSettings().then(() => {
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private async addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void> {
    if (tasks.length === 0) return;
    for (const task of tasks) {
      if (task.source === "vault") {
        if (entry.source === "apple-reminders") {
          await this.plugin.sendTaskToAppleReminders(task, { type: "apple-reminders", listId: entry.externalListId });
        } else {
          await this.plugin.sendTaskToDida(task, { type: "dida", projectId: entry.externalListId });
        }
        continue;
      }
      if (task.source !== entry.source || task.externalListId === entry.externalListId) {
        continue;
      }
      if (task.source === "apple-reminders") {
        await this.plugin.moveAppleReminderToList(task, entry.externalListId);
        continue;
      }
      if (task.source === "dida") {
        await this.plugin.moveDidaTaskToProject(task, entry.externalListId);
      }
    }
  }

  private removeTasksFromActiveSmartList(tasks: TaskItem[]): void {
    if (tasks.length === 0 || !this.activeSmartListId) return;
    const now = new Date().toISOString();
    let changed = false;
    this.plugin.settings.smartLists = this.plugin.settings.smartLists.map((item) => {
      if (item.id !== this.activeSmartListId) return item;
      const references = removeSmartListTaskReferences(item, tasks);
      if (smartListReferencesEqual(item, references)) {
        return item;
      }
      changed = true;
      return {
        ...item,
        ...references,
        updatedAt: now
      };
    });
    if (!changed) return;
    this.selectedTaskIds = new Set([...this.selectedTaskIds].filter((taskId) => !tasks.some((task) => task.id === taskId)));
    if (this.selectedTaskId && tasks.some((task) => task.id === this.selectedTaskId)) {
      this.selectedTaskId = undefined;
      this.selectedTaskStableId = undefined;
    }
    void this.plugin.saveSettings().then(() => {
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private deleteSmartList(smartList: TaskHubSmartList): void {
    const t = createTranslator(this.plugin.settings.language);
    const confirmed = this.containerEl.win.confirm(`${t("deleteSmartList")}: ${smartList.name}?`);
    if (!confirmed) return;
    this.plugin.settings.smartLists = this.plugin.settings.smartLists.filter((item) => item.id !== smartList.id);
    if (this.activeSmartListId === smartList.id) this.clearActiveSmartListState();
    void this.plugin.saveSettings().then(() => {
      new Notice(t("smartListDeleted"));
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private renameSmartList(smartList: TaskHubSmartList, name: string): void {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === smartList.name) return;
    const now = new Date().toISOString();
    let changed = false;
    this.plugin.settings.smartLists = this.plugin.settings.smartLists.map((item) => {
      if (item.id !== smartList.id) return item;
      changed = true;
      return {
        ...item,
        name: trimmedName,
        updatedAt: now
      };
    });
    if (!changed) return;
    void this.plugin.saveSettings().then(() => {
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private updateSmartListColor(smartList: TaskHubSmartList, color: string | undefined): void {
    const now = new Date().toISOString();
    this.plugin.settings.smartLists = this.plugin.settings.smartLists.map((item) => {
      if (item.id !== smartList.id) return item;
      return {
        ...item,
        ...(color ? { color } : { color: undefined }),
        updatedAt: now
      };
    });
    void this.plugin.saveSettings().then(() => {
      this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
    });
  }

  private activeSmartList(): TaskHubSmartList | undefined {
    return (this.plugin.settings.smartLists ?? []).find((smartList) => smartList.id === this.activeSmartListId);
  }

  private migrateLegacySmartLists(allTasks: TaskItem[], now: Date): void {
    const migrated = materializeLegacySmartLists(allTasks, this.plugin.settings.smartLists, now);
    if (!migrated.changed) return;
    this.plugin.settings.smartLists = migrated.smartLists;
    void this.plugin.saveSettings();
  }

  private externalTaskListEntries(
    tasks: readonly TaskItem[] = typeof this.plugin.getTasks === "function" ? this.plugin.getTasks() : [],
    includeCompleted = this.filters.status !== "open"
  ): ExternalTaskListFilterEntry[] {
    const entries: ExternalTaskListFilterEntry[] = [];
    const seenIds = new Set<string>();
    const localAppleSettings = this.plugin.settings.localApple;
    const didaSettings = this.plugin.settings.dida;

    if (localAppleSettings?.enabled && localAppleSettings.remindersEnabled) {
      const listColors = this.plugin.getAppleReminderListColors();
      for (const list of this.plugin.getAppleReminderLists()) {
        const externalListId = list.id?.trim();
        const name = list.name?.trim();
        if (!externalListId || !name) continue;
        const id = externalTaskListFilterEntryId("apple-reminders", externalListId);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        entries.push({
          id,
          externalListId,
          source: "apple-reminders",
          name,
          color: listColors[externalListId] ?? localAppleSettings.remindersColor,
          itemCount: countExternalListTasks(tasks, "apple-reminders", externalListId, includeCompleted)
        });
      }
    }

    if (didaSettings?.enabled && didaSettings.tasksEnabled) {
      const projectColors = this.plugin.getDidaProjectColors();
      for (const project of this.plugin.getDidaProjects()) {
        const externalListId = project.id?.trim();
        const name = project.name?.trim();
        if (!externalListId || !name) continue;
        const id = externalTaskListFilterEntryId("dida", externalListId);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        entries.push({
          id,
          externalListId,
          source: "dida",
          name,
          color: projectColors[externalListId] ?? didaSettings.tasksColor,
          itemCount: countExternalListTasks(tasks, "dida", externalListId, includeCompleted)
        });
      }
    }

    return entries;
  }

  private reconcileExternalListFilterSelection(entries: readonly ExternalTaskListFilterEntry[]): void {
    if (!this.selectedExternalListFilterId) return;
    if (entries.some((entry) => entry.id === this.selectedExternalListFilterId)) return;
    this.selectedExternalListFilterId = undefined;
    this.syncSessionStateToSettings();
  }

  private visibleExternalTaskListEntries(entries: readonly ExternalTaskListFilterEntry[]): ExternalTaskListFilterEntry[] {
    const hiddenIds = this.hiddenExternalTaskListFilterIds(entries);
    if (hiddenIds.length === 0) return [...entries];
    const hiddenIdSet = new Set(hiddenIds);
    return entries.filter((entry) => !hiddenIdSet.has(entry.id));
  }

  private hiddenExternalTaskListFilterIds(entries: readonly ExternalTaskListFilterEntry[]): string[] {
    const hiddenIds = this.plugin.settings.hiddenExternalTaskListFilterIds ?? [];
    if (hiddenIds.length === 0) return [];
    const entryIds = new Set(entries.map((entry) => entry.id));
    if (hiddenIds.some((id) => !entryIds.has(id))) {
      this.plugin.settings.hiddenExternalTaskListFilterIds = [];
      return [];
    }
    return hiddenIds;
  }

  private activeExternalListFilterEntry(
    entries: readonly ExternalTaskListFilterEntry[] = this.externalTaskListEntries()
  ): ExternalTaskListFilterEntry | undefined {
    if (!this.selectedExternalListFilterId) return undefined;
    return entries.find((entry) => entry.id === this.selectedExternalListFilterId);
  }

  private applyExternalListFilter(
    tasks: TaskItem[],
    entries: readonly ExternalTaskListFilterEntry[] = this.externalTaskListEntries()
  ): TaskItem[] {
    const activeExternalListFilter = this.activeExternalListFilterEntry(entries);
    if (!activeExternalListFilter) return tasks;
    return tasks.filter((task) => this.taskMatchesExternalListFilter(task, activeExternalListFilter));
  }

  private taskMatchesExternalListFilter(task: TaskItem, entry: ExternalTaskListFilterEntry | undefined): boolean {
    if (!entry) return true;
    return task.source === entry.source && task.externalListId === entry.externalListId;
  }

  private toggleExternalListFilter(entry: ExternalTaskListFilterEntry): void {
    this.selectedExternalListFilterId = this.selectedExternalListFilterId === entry.id ? undefined : entry.id;
    this.selectedTaskId = undefined;
    this.selectedTaskStableId = undefined;
    this.selectedTaskIds = new Set();
    this.persistSessionState();
    this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
  }

  private openExternalListVisibilityModal(entries: readonly ExternalTaskListFilterEntry[]): void {
    const t = createTranslator(this.plugin.settings.language);
    new ExternalListVisibilityModal(
      this.app,
      entries,
      new Set(this.hiddenExternalTaskListFilterIds(entries)),
      async (hiddenIds) => {
        this.plugin.settings.hiddenExternalTaskListFilterIds = hiddenIds;
        if (this.selectedExternalListFilterId && hiddenIds.includes(this.selectedExternalListFilterId)) {
          this.selectedExternalListFilterId = undefined;
          this.selectedTaskId = undefined;
          this.selectedTaskStableId = undefined;
          this.selectedTaskIds = new Set();
          this.syncSessionStateToSettings();
        }
        await this.plugin.saveSettings();
        this.render({ preserveTaskListScroll: true, preserveContentScroll: true });
      },
      t
    ).open();
  }

  private clearActiveSmartListState(): void {
    this.activeSmartListId = undefined;
    this.selectedTaskIds = new Set();
    this.selectedTaskId = undefined;
    this.selectedTaskStableId = undefined;
  }

  private withLinkedNoteSubtasks(tasks: TaskItem[]): TaskItem[] {
    if (!this.plugin.settings.taskNotes.enabled || !this.plugin.settings.taskNotes.linkedNoteSubtasksEnabled) return tasks;
    const tasksByNoteLine = new Map(tasks.map((task) => [taskLocationKey(task.filePath, task.line, task.rawLine), task]));
    const tasksByNoteRawLine = groupTasksByRawLine(tasks);
    const usedExistingTaskIds = new Set<string>();
    const linkedUpdates = new Map<string, Pick<TaskItem, "parentId" | "indent" | "heading">>();
    const syntheticSubtasks: TaskItem[] = [];

    for (const task of tasks) {
      for (const note of this.plugin.getTaskNotes(task)) {
        const parsed = parseTasksFromMarkdown({ filePath: note.path, content: note.body });
        const noteTaskIds = new Map<string, string>();
        const existingTasks = new Map<string, TaskItem | undefined>();
        for (const noteTask of parsed) {
          const line = note.bodyStartLine + noteTask.line;
          const existing = findExistingLinkedNoteTask(note.path, line, noteTask, tasksByNoteLine, tasksByNoteRawLine, usedExistingTaskIds);
          if (existing) usedExistingTaskIds.add(existing.id);
          existingTasks.set(noteTask.id, existing);
          noteTaskIds.set(noteTask.id, existing?.id ?? linkedNoteSubtaskId(task, note.path, noteTask));
        }

        for (const noteTask of parsed) {
          const line = note.bodyStartLine + noteTask.line;
          const parentId = noteTask.parentId ? noteTaskIds.get(noteTask.parentId) ?? task.id : task.id;
          const childShape = {
            parentId,
            indent: (task.indent ?? 0) + (noteTask.indent ?? 0) + 1,
            heading: note.title
          };
          const existing = existingTasks.get(noteTask.id);
          if (existing) {
            linkedUpdates.set(existing.id, childShape);
          } else {
            syntheticSubtasks.push({
              ...noteTask,
              ...childShape,
              id: noteTaskIds.get(noteTask.id) ?? linkedNoteSubtaskId(task, note.path, noteTask),
              line
            });
          }
        }
      }
    }

    if (linkedUpdates.size === 0 && syntheticSubtasks.length === 0) return tasks;
    return [
      ...tasks.map((task) => {
        const update = linkedUpdates.get(task.id);
        return update ? { ...task, ...update } : task;
      }),
      ...syntheticSubtasks
    ];
  }

  private pruneSelectedTaskIds(visibleTasks: TaskItem[]): void {
    const selection = reconcileVisibleTaskSelection(
      visibleTasks,
      this.selectedTaskId,
      this.selectedTaskStableId,
      this.selectedTaskIds
    );
    this.selectedTaskId = selection.selectedTaskId;
    this.selectedTaskStableId = selection.selectedTaskStableId;
    this.selectedTaskIds = selection.selectedTaskIds;
  }

  private updateTaskSelection(task: TaskItem, taskIds?: string[]): void {
    this.selectedTaskId = task.id;
    this.selectedTaskStableId = task.stableId ?? task.id;
    this.selectedTaskIds = new Set(taskIds && taskIds.length > 0 ? taskIds : [task.id]);
  }

  private canScheduleTask(task: TaskItem): boolean {
    if (task.source === "vault") return true;
    if (task.source === "apple-reminders") {
      return this.plugin.settings.localApple.remindersWritebackEnabled && Boolean(task.externalId);
    }
    if (task.source === "dida") {
      return Boolean(
        this.plugin.settings.dida.tasksWritebackEnabled &&
          this.plugin.settings.dida.tasksDragRescheduleEnabled &&
          task.externalId &&
          task.externalListId
      );
    }
    return false;
  }

  private exitingTaskIds(allTasks: TaskItem[]): ReadonlySet<string> {
    if (this.filters.status !== "open" || this.completingTaskIds.size === 0) {
      return new Set();
    }
    const completedIds = new Set(allTasks.filter((task) => task.completed).map((task) => task.id));
    return new Set([...this.completingTaskIds].filter((taskId) => completedIds.has(taskId)));
  }

  private async completeTaskFromView(task: TaskItem): Promise<void> {
    this.updateTaskSelection(task);
    this.captureTaskListScroll();
    this.captureContentScroll();
    this.completingTaskIds.add(task.id);
    let keepForExitAnimation = false;
    try {
      const result = await this.plugin.completeTask(task);
      if (result.status === "updated" && !task.completed && this.filters.status === "open") {
        keepForExitAnimation = true;
        this.containerEl.win.setTimeout(() => {
          this.completingTaskIds.delete(task.id);
          this.render({ preserveCalendarAgendaScroll: true, preserveContentScroll: true, preserveTaskListScroll: true });
        }, 360);
        return;
      }
    } finally {
      if (!keepForExitAnimation) {
        this.completingTaskIds.delete(task.id);
      }
    }
  }

  private captureContentScroll(): void {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    this.contentScrollTop = container?.scrollTop ?? this.contentScrollTop;
  }

  private captureCalendarAgendaScroll(): void {
    if (this.view !== "calendar" || (this.calendarMode !== "day" && this.calendarMode !== "week")) return;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const agenda = container?.querySelector<HTMLElement>(".task-hub-agenda");
    if (!agenda) return;
    this.calendarAgendaScrollPosition = {
      top: agenda.scrollTop,
      left: agenda.scrollLeft,
      allDaySlotTops: readCalendarAllDaySlotScrollTops(agenda)
    };
  }

  private captureCalendarDaySidebarScroll(): void {
    if (this.view !== "calendar" || this.calendarMode !== "day") return;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const sidebar = container?.querySelector<HTMLElement>(".task-hub-calendar-day-sidebar");
    if (!sidebar) return;
    this.calendarDaySidebarScrollTop = sidebar.scrollTop;
  }

  private restoreContentScroll(options: TaskHubRenderOptions): void {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    restoreContentScrollAfterRender(container, {
      preserveScroll: shouldPreserveScroll(options),
      scrollTop: this.contentScrollTop
    });
  }

  private restoreViewport(options: TaskHubRenderOptions): void {
    if (!shouldPreserveScroll(options)) return;
    if (options.preserveContentScroll) {
      this.restoreContentScroll(options);
    }
    if (options.preserveTaskListScroll) {
      const container = this.containerEl.children[1] as HTMLElement | undefined;
      const list = container ? findTaskListPane(container) : undefined;
      if (list) list.scrollTop = this.taskListScrollTop;
      const smartList = container?.querySelector<HTMLElement>(".task-hub-smart-list-items");
      const externalList = container?.querySelector<HTMLElement>(".task-hub-external-list-items");
      if (smartList) smartList.scrollTop = this.smartListScrollTop;
      if (externalList) externalList.scrollTop = this.externalListScrollTop;
    }
    if (options.preserveCalendarAgendaScroll) {
      const container = this.containerEl.children[1] as HTMLElement | undefined;
      const agenda = container?.querySelector<HTMLElement>(".task-hub-agenda");
      if (agenda && this.calendarAgendaScrollPosition) {
        agenda.scrollTop = this.calendarAgendaScrollPosition.top;
        agenda.scrollLeft = this.calendarAgendaScrollPosition.left;
        restoreCalendarAllDaySlotScrollTops(agenda, this.calendarAgendaScrollPosition.allDaySlotTops);
      }
      const sidebar = container?.querySelector<HTMLElement>(".task-hub-calendar-day-sidebar");
      if (sidebar) sidebar.scrollTop = this.calendarDaySidebarScrollTop;
    }
  }

  private scheduleViewportRestore(options: TaskHubRenderOptions): void {
    if (!shouldPreserveScroll(options)) return;
    this.clearPendingViewportRestores();
    this.restoreViewport(options);
    const win = this.containerEl.win;
    if (typeof win.requestAnimationFrame === "function") {
      const id = win.requestAnimationFrame(() => this.restoreViewport(options));
      this.pendingViewportRestoreHandles.push({ kind: "animationFrame", id });
    }
    for (const delay of [80, 180]) {
      const id = win.setTimeout(() => this.restoreViewport(options), delay);
      this.pendingViewportRestoreHandles.push({ kind: "timeout", id });
    }
  }

  private clearPendingViewportRestores(): void {
    const win = this.containerEl?.win;
    if (!win) {
      this.pendingViewportRestoreHandles = [];
      return;
    }
    for (const handle of this.pendingViewportRestoreHandles) {
      if (handle.kind === "animationFrame" && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(handle.id);
      } else if (handle.kind === "timeout") {
        win.clearTimeout(handle.id);
      }
    }
    this.pendingViewportRestoreHandles = [];
  }

  private scheduleExpandedTaskScroll(taskId: string): void {
    while (this.pendingExpandedTaskScrollTimers.length > 0) {
      const timer = this.pendingExpandedTaskScrollTimers.pop();
      if (timer !== undefined) this.containerEl.win.clearTimeout(timer);
    }

    const contentContainer = this.containerEl.children[1] as HTMLElement | undefined;
    const syncScroll = () => scrollExpandedTaskIntoView(contentContainer, taskId);
    syncScroll();
    for (const delay of [90, 190, 280]) {
      this.pendingExpandedTaskScrollTimers.push(this.containerEl.win.setTimeout(syncScroll, delay));
    }
  }

  private async withPreservedCalendarViewport<T>(action: () => Promise<T>): Promise<T> {
    this.captureContentScroll();
    this.captureCalendarAgendaScroll();
    return action();
  }

  private updateFilters(
    filters: TaskFilterState,
    options: TaskHubRenderOptions = {},
    updateOptions: { keepActiveSmartList?: boolean } = {}
  ): void {
    if (!updateOptions.keepActiveSmartList) this.activeSmartListId = undefined;
    this.filters = cloneTaskFilters(filters);
    this.plugin.settings.taskViewFilters = cloneTaskFilters(this.filters);
    this.syncSessionStateToSettings();
    void this.plugin.saveSettings();
    this.render(options);
  }

  private persistSessionState(): void {
    this.syncSessionStateToSettings();
    const saveData = (this.plugin as unknown as { saveData?: (data: TaskHubSettings) => Promise<unknown> }).saveData;
    if (typeof saveData !== "function") return;
    void saveData.call(this.plugin, this.plugin.settings);
  }

  private syncSessionStateToSettings(): void {
    this.plugin.settings.taskViewFilters = cloneTaskFilters(this.filters);
    this.plugin.settings.lastSessionState = createTaskHubSessionSnapshot({
      view: this.view,
      filters: this.filters,
      selectedExternalListFilterId: this.selectedExternalListFilterId,
      calendarMode: this.calendarMode,
      calendarFocusDate: this.calendarFocusDate,
      visibleSourceIds: this.visibleSourceIds,
      unscheduledPanelOpen: this.unscheduledPanelOpen
    });
  }

  private async reorderTagCards(sourceTag: string, targetTag: string): Promise<void> {
    const currentTags = collectTags(this.plugin.getTasks());
    const order = buildTagOrder(currentTags, this.plugin.settings.tagViewOrder);
    const sourceIndex = order.indexOf(sourceTag);
    const targetIndex = order.indexOf(targetTag);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;
    const next = [...order];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    this.plugin.settings.tagViewOrder = next;
    await this.plugin.saveSettings();
    this.render();
  }

}

class ExternalListVisibilityModal extends Modal {
  constructor(
    app: App,
    private readonly entries: readonly ExternalTaskListFilterEntry[],
    hiddenIds: ReadonlySet<string>,
    private readonly onSave: (hiddenIds: string[]) => Promise<void>,
    private readonly t: ReturnType<typeof createTranslator>
  ) {
    super(app);
    this.hiddenIds = new Set(hiddenIds);
  }

  private readonly hiddenIds: Set<string>;

  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
    titleEl.setText(this.t("externalListVisibilityTitle"));
    contentEl.addClass("task-hub-external-list-visibility-modal");
    contentEl.createEl("p", {
      cls: "task-hub-external-list-visibility-desc",
      text: this.t("externalListVisibilityDesc")
    });

    if (this.entries.length === 0) {
      contentEl.createDiv({
        cls: "task-hub-external-list-visibility-empty",
        text: this.t("externalListVisibilityEmpty")
      });
      return;
    }

    const list = contentEl.createDiv({ cls: "task-hub-external-list-visibility-list" });
    for (const entry of this.entries) {
      const row = list.createEl("label", { cls: "task-hub-external-list-visibility-row" });
      const checkbox = row.createEl("input", {
        cls: "task-hub-external-list-visibility-checkbox",
        attr: { type: "checkbox" }
      });
      checkbox.checked = !this.hiddenIds.has(entry.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.hiddenIds.delete(entry.id);
        } else {
          this.hiddenIds.add(entry.id);
        }
      });
      const name = row.createSpan({ cls: "task-hub-external-list-visibility-name", text: entry.name });
      name.setAttr("title", entry.name);
      row.createSpan({ cls: "task-hub-external-list-visibility-meta", text: String(entry.itemCount) });
      renderSourceLogo(
        row,
        "task-hub-external-list-visibility-source",
        entry.source === "apple-reminders" ? "apple" : "dida"
      );
    }

    const actions = contentEl.createDiv({ cls: "task-hub-external-list-visibility-actions" });
    const cancel = actions.createEl("button", {
      cls: "task-hub-external-list-visibility-action",
      text: this.t("cancel"),
      attr: { type: "button" }
    });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", {
      cls: "task-hub-external-list-visibility-action mod-cta",
      text: this.t("save"),
      attr: { type: "button" }
    });
    save.addEventListener("click", async () => {
      await this.onSave([...this.hiddenIds]);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function reconcileVisibleTaskSelection(
  visibleTasks: TaskItem[],
  selectedTaskId: string | undefined,
  selectedTaskStableId: string | undefined,
  selectedTaskIds: ReadonlySet<string>
): {
  selectedTaskId: string | undefined;
  selectedTaskStableId: string | undefined;
  selectedTaskIds: Set<string>;
} {
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const visibleByStableId = new Map(visibleTasks.map((task) => [task.stableId ?? task.id, task]));
  const nextSelectedTaskIds = new Set([...selectedTaskIds].filter((taskId) => visibleIds.has(taskId)));
  let nextSelectedTask = selectedTaskId ? visibleTasks.find((task) => task.id === selectedTaskId) : undefined;

  if (!nextSelectedTask && selectedTaskStableId) {
    nextSelectedTask = visibleByStableId.get(selectedTaskStableId);
  }

  if (!nextSelectedTask && nextSelectedTaskIds.size > 0) {
    nextSelectedTask = visibleTasks.find((task) => nextSelectedTaskIds.has(task.id));
  }

  if (!nextSelectedTask) {
    return {
      selectedTaskId: undefined,
      selectedTaskStableId: undefined,
      selectedTaskIds: nextSelectedTaskIds
    };
  }

  nextSelectedTaskIds.add(nextSelectedTask.id);
  return {
    selectedTaskId: nextSelectedTask.id,
    selectedTaskStableId: nextSelectedTask.stableId ?? nextSelectedTask.id,
    selectedTaskIds: nextSelectedTaskIds
  };
}

export function restoreContentScrollAfterRender(
  container: HTMLElement | undefined,
  options: { preserveScroll?: boolean; scrollTop: number }
): void {
  if (!options.preserveScroll || !container) return;
  container.scrollTop = options.scrollTop;
}

export function scrollDatedNoteDetailToTop(container: HTMLElement | undefined): void {
  const detail = container?.querySelector<HTMLElement>(".task-hub-dated-note-detail");
  if (!detail) return;
  detail.scrollTop = 0;
}

export function scrollExpandedTaskIntoView(
  container: HTMLElement | undefined,
  taskId: string,
  padding = 18
): void {
  if (!container) return;
  const row = findDescendantByAttr(container, "data-task-id", taskId);
  if (!row) return;
  const subtaskList = findNextSiblingSubtaskList(row);
  const bottomAnchor = findBottomMostTaskElement(subtaskList) ?? subtaskList ?? row;
  maybeScrollIntoView(row);
  maybeScrollIntoView(bottomAnchor);

  const viewport = findScrollViewport(row, container) ?? container;
  const listRect = viewport.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const subtreeBottom = bottomAnchor.getBoundingClientRect().bottom;
  const visibleTop = listRect.top + padding;
  const visibleBottom = listRect.bottom - padding;

  let delta = 0;
  if (rowRect.top < visibleTop) {
    delta = rowRect.top - visibleTop;
  } else if (subtreeBottom > visibleBottom) {
    delta = subtreeBottom - visibleBottom;
  }
  if (delta === 0) return;

  const nextTop = Math.max(0, viewport.scrollTop + delta);
  if (typeof viewport.scrollTo === "function") {
    viewport.scrollTo({ top: nextTop, behavior: "smooth" });
    return;
  }
  viewport.scrollTop = nextTop;
}

function shouldPreserveScroll(options: TaskHubRenderOptions): boolean {
  return Boolean(options.preserveTaskListScroll || options.preserveContentScroll || options.preserveCalendarAgendaScroll);
}

export function buildTaskViewTransitionKey(
  filters: TaskFilterState,
  activeSmartListId: string | undefined,
  selectedExternalListFilterId: string | undefined = undefined
): string {
  return JSON.stringify({
    activeSmartListId: activeSmartListId ?? "",
    selectedExternalListFilterId: selectedExternalListFilterId ?? "",
    status: filters.status,
    dateBucket: filters.dateBucket ?? "",
    tags: [...filters.tags].sort(),
    tagQuery: filters.tagQuery?.trim() ?? "",
    sourceQuery: filters.sourceQuery ?? "",
    textQuery: filters.textQuery?.trim() ?? "",
    conditions: filters.conditions
      ? {
          operator: filters.conditions.operator ?? "and",
          tag: filters.conditions.tag?.trim() ?? "",
          dateBucket: filters.conditions.dateBucket ?? "",
          text: filters.conditions.text?.trim() ?? ""
        }
      : undefined
  });
}

export function collectUnscheduledTasks(
  tasks: TaskItem[],
  filters: TaskFilterState,
  now: Date,
  canScheduleTask: (task: TaskItem) => boolean
): TaskItem[] {
  return filterTasks(tasks, filters, now)
    .filter((task) => !taskPlannedDateKey(task) && canScheduleTask(task))
    .sort(compareUnscheduledTasks);
}

export function collectCalendarUnscheduledTasks(
  tasks: TaskItem[],
  filters: TaskFilterState,
  now: Date,
  canScheduleTask: (task: TaskItem) => boolean,
  completingTaskIds: ReadonlySet<string>
): TaskItem[] {
  const visible = collectUnscheduledTasks(tasks, filters, now, canScheduleTask);
  if (filters.status !== "open" || completingTaskIds.size === 0) return visible;

  const visibleIds = new Set(visible.map((task) => task.id));
  const exiting = tasks.filter((task) => {
    if (!completingTaskIds.has(task.id) || visibleIds.has(task.id) || !task.completed || taskPlannedDateKey(task) || !canScheduleTask(task)) return false;
    return filterTasks([task], { ...filters, status: "all" }, now).length > 0;
  });
  return [...visible, ...exiting].sort(compareUnscheduledTasks);
}

export function shouldHandleTaskHubUndoShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.altKey || event.shiftKey) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.key.toLowerCase() !== "z") return false;
  return !isEditableUndoTarget(event.target);
}

function isEditableUndoTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
  };
  if (element.isContentEditable) return true;
  const tagName = element.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function compareUnscheduledTasks(left: TaskItem, right: TaskItem): number {
  return (
    taskSourceRank(left) - taskSourceRank(right) ||
    left.filePath.localeCompare(right.filePath) ||
    left.line - right.line ||
    left.text.localeCompare(right.text)
  );
}

function findTaskListPane(container: HTMLElement): HTMLElement | undefined {
  return container.querySelector<HTMLElement>(".task-hub-task-list-pane") ?? undefined;
}

function readCalendarAllDaySlotScrollTops(agenda: HTMLElement): Record<string, number> {
  const result: Record<string, number> = {};
  for (const slot of findCalendarAllDaySlots(agenda)) {
    const day = readElementAttr(slot, "data-task-hub-agenda-day");
    if (!day) continue;
    result[day] = slot.scrollTop;
  }
  return result;
}

function restoreCalendarAllDaySlotScrollTops(agenda: HTMLElement, positions: Record<string, number> | undefined): void {
  if (!positions) return;
  for (const slot of findCalendarAllDaySlots(agenda)) {
    const day = readElementAttr(slot, "data-task-hub-agenda-day");
    if (!day || positions[day] === undefined) continue;
    slot.scrollTop = positions[day];
  }
}

function findCalendarAllDaySlots(root: HTMLElement): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const hasClass =
    "classList" in root
      ? root.classList.contains("task-hub-agenda-all-day-slot")
      : (root as HTMLElement & { classes?: Set<string> }).classes?.has("task-hub-agenda-all-day-slot");
  if (hasClass) matches.push(root);
  for (const child of Array.from(root.children)) {
    matches.push(...findCalendarAllDaySlots(child as HTMLElement));
  }
  return matches;
}

function findDescendantByAttr(root: HTMLElement, name: string, value: string): HTMLElement | undefined {
  if (readElementAttr(root, name) === value) return root;
  for (const child of Array.from(root.children)) {
    const match = findDescendantByAttr(child as HTMLElement, name, value);
    if (match) return match;
  }
  return undefined;
}

function maybeScrollIntoView(element: HTMLElement | undefined): void {
  if (!element || typeof element.scrollIntoView !== "function") return;
  element.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function findBottomMostTaskElement(list: HTMLElement | undefined): HTMLElement | undefined {
  if (!list) return undefined;
  const taskRows = findDescendantsByClass(list, "task-hub-task-row");
  return taskRows.at(-1) ?? list;
}

function findDescendantsByClass(root: HTMLElement, className: string): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const hasClass =
    "classList" in root
      ? root.classList.contains(className)
      : (root as HTMLElement & { classes?: Set<string> }).classes?.has(className);
  if (hasClass) matches.push(root);
  for (const child of Array.from(root.children)) {
    matches.push(...findDescendantsByClass(child as HTMLElement, className));
  }
  return matches;
}

function readElementAttr(element: HTMLElement, name: string): string | undefined {
  if (typeof element.getAttribute === "function") {
    return element.getAttribute(name) ?? undefined;
  }
  const attrs = (element as HTMLElement & { attrs?: Map<string, string> }).attrs;
  return attrs?.get(name);
}

function findScrollViewport(target: HTMLElement, fallback: HTMLElement): HTMLElement | undefined {
  let current: HTMLElement | undefined = target;
  while (current) {
    if (isScrollableViewport(current)) return current;
    current = current.parentElement ?? undefined;
  }
  return isScrollableViewport(fallback) ? fallback : undefined;
}

function isScrollableViewport(element: HTMLElement): boolean {
  const maybeScrollable = typeof element.scrollTop === "number";
  if (!maybeScrollable) return false;
  const scrollHeight = "scrollHeight" in element ? Number(element.scrollHeight) : NaN;
  const clientHeight = "clientHeight" in element ? Number(element.clientHeight) : NaN;
  if (Number.isFinite(scrollHeight) && Number.isFinite(clientHeight)) {
    return scrollHeight > clientHeight;
  }
  return true;
}

function findNextSiblingSubtaskList(row: HTMLElement): HTMLElement | undefined {
  const parent = row.parentElement;
  if (!parent) return undefined;
  const siblings = Array.from(parent.children);
  const rowIndex = siblings.indexOf(row);
  if (rowIndex === -1) return undefined;
  const sibling = siblings[rowIndex + 1] as HTMLElement | undefined;
  if (!sibling) return undefined;
  return readElementAttr(sibling, "data-parent-task-id") ? sibling : undefined;
}

function taskSourceFilterOptions(tasks: TaskItem[], filters: TaskFilterState, now: Date, t: ReturnType<typeof createTranslator>) {
  const sourceCountTasks = filterTasks(tasks, { ...filters, sourceQuery: "" }, now);
  return [
    { id: "all" as const, label: t("all"), count: sourceCountTasks.length },
    { id: "vault" as const, label: t("vaultTasks"), count: sourceCountTasks.filter((task) => task.source === "vault").length },
    { id: "apple-reminders" as const, label: "Apple Reminders", count: sourceCountTasks.filter((task) => task.source === "apple-reminders").length },
    { id: "dida" as const, label: t("dida"), count: sourceCountTasks.filter((task) => task.source === "dida").length }
  ];
}

function collectTags(tasks: TaskItem[]): string[] {
  return Array.from(new Set(tasks.flatMap((task) => task.tags))).sort((a, b) => a.localeCompare(b));
}

function buildTagOrder(currentTags: string[], storedOrder: string[]): string[] {
  const known = storedOrder.filter((tag) => currentTags.includes(tag));
  const missing = currentTags.filter((tag) => !known.includes(tag));
  return [...known, ...missing];
}

function moveDate(date: Date, mode: CalendarViewMode, direction: -1 | 1): Date {
  const next = new Date(date);
  if (mode === "day") next.setDate(next.getDate() + direction);
  if (mode === "week") next.setDate(next.getDate() + direction * 7);
  if (mode === "month") next.setMonth(next.getMonth() + direction);
  return next;
}

function calendarModeTransitionDirection(from: CalendarViewMode, to: CalendarViewMode): CalendarModeTransitionDirection | undefined {
  if (from === to) return undefined;
  return calendarModeRank(to) > calendarModeRank(from) ? "left" : "right";
}

function calendarModeRank(mode: CalendarViewMode): number {
  if (mode === "day") return 0;
  if (mode === "week") return 1;
  return 2;
}

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function linkedNoteSubtaskId(parentTask: TaskItem, notePath: string, noteTask: TaskItem): string {
  return `note-subtask:${parentTask.id}:${notePath}:${noteTask.line}:${hashTaskLine(noteTask.rawLine)}`;
}

function taskLocationKey(filePath: string, line: number, rawLine: string): string {
  return `${filePath}:${line}:${normalizeTaskRawLineForMatch(rawLine)}`;
}

function groupTasksByRawLine(tasks: TaskItem[]): Map<string, TaskItem[]> {
  const grouped = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    if (!task.rawLine) continue;
    const key = taskRawLineKey(task.filePath, task.rawLine);
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }
  return grouped;
}

function findExistingLinkedNoteTask(
  notePath: string,
  line: number,
  noteTask: TaskItem,
  tasksByNoteLine: Map<string, TaskItem>,
  tasksByNoteRawLine: Map<string, TaskItem[]>,
  usedTaskIds: ReadonlySet<string>
): TaskItem | undefined {
  const exact = tasksByNoteLine.get(taskLocationKey(notePath, line, noteTask.rawLine));
  if (exact && !usedTaskIds.has(exact.id)) return exact;

  return (tasksByNoteRawLine.get(taskRawLineKey(notePath, noteTask.rawLine)) ?? [])
    .filter((task) => !usedTaskIds.has(task.id))
    .sort((left, right) => Math.abs(left.line - line) - Math.abs(right.line - line))[0];
}

function taskRawLineKey(filePath: string, rawLine: string): string {
  return `${filePath}:${normalizeTaskRawLineForMatch(rawLine)}`;
}

function normalizeTaskRawLineForMatch(rawLine: string): string {
  return rawLine.trimEnd();
}

function hashTaskLine(value: string): string {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33) ^ value.charCodeAt(index);
  }
  return (result >>> 0).toString(36);
}

function taskSourceRank(task: TaskItem): number {
  if (task.source === "vault") return 0;
  if (task.source === "apple-reminders") return 1;
  if (task.source === "dida") return 2;
  return 3;
}

function cloneTaskFilters(filters: TaskFilterState): TaskFilterState {
  return {
    ...filters,
    tags: [...filters.tags],
    conditions: filters.conditions ? { ...filters.conditions } : undefined
  };
}

export function clearTaskViewFilters(filters: TaskFilterState): TaskFilterState {
  return {
    ...filters,
    status: "open",
    dateBucket: undefined,
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: "",
    conditions: { operator: "and", tag: "", dateBucket: "", text: "" }
  };
}

export function buildSavedSmartList(input: {
  existingSmartLists: readonly TaskHubSmartList[];
  name: string;
  tasks: TaskItem[];
  now: Date;
  createId?: (existing: readonly TaskHubSmartList[]) => string;
}): TaskHubSmartList | undefined {
  const name = input.name.trim();
  if (!name) return undefined;
  const timestamp = input.now.toISOString();
  return {
    id: (input.createId ?? createSmartListId)(input.existingSmartLists),
    name,
    ...smartListTaskReferences(input.tasks),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createSmartListId(existing: readonly TaskHubSmartList[]): string {
  const existingIds = new Set(existing.map((smartList) => smartList.id));
  let id = "";
  do {
    id = `smart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  } while (existingIds.has(id));
  return id;
}

export function smartListCountsForTasks(
  tasks: TaskItem[],
  smartLists: readonly TaskHubSmartList[],
  now: Date,
  status: TaskFilterState["status"] = "all"
): ReadonlyMap<string, number> {
  return new Map(smartLists.map((smartList) => [
    smartList.id,
    filterTasksByStatus(applySmartListToTasks(tasks, smartList, now), status).length
  ]));
}

function filterTasksByStatus(tasks: TaskItem[], status: TaskFilterState["status"]): TaskItem[] {
  if (status === "open") return tasks.filter((task) => !task.completed);
  if (status === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}

function tasksWithDescendants(allTasks: TaskItem[], rootTasks: TaskItem[]): TaskItem[] {
  if (rootTasks.length === 0) return [];
  const childrenByParentId = new Map<string, TaskItem[]>();
  for (const task of allTasks) {
    if (!task.parentId) continue;
    const children = childrenByParentId.get(task.parentId) ?? [];
    children.push(task);
    childrenByParentId.set(task.parentId, children);
  }
  const result: TaskItem[] = [];
  const visitedTaskIds = new Set<string>();
  const visit = (task: TaskItem) => {
    if (visitedTaskIds.has(task.id)) return;
    visitedTaskIds.add(task.id);
    result.push(task);
    for (const child of childrenByParentId.get(task.id) ?? []) {
      visit(child);
    }
  };
  for (const task of rootTasks) {
    visit(task);
  }
  return result;
}

function mergeSmartListTaskReferences(
  smartList: TaskHubSmartList,
  tasks: TaskItem[]
): Pick<TaskHubSmartList, "taskStableIds" | "taskIds"> {
  const references = smartListTaskReferences(tasks);
  const stableBackedTaskIds = new Set(tasks.filter((task) => task.stableId).map((task) => task.id));
  return {
    taskStableIds: uniqueStrings([...smartList.taskStableIds, ...references.taskStableIds]).slice(0, 500),
    taskIds: uniqueStrings([...smartList.taskIds.filter((taskId) => !stableBackedTaskIds.has(taskId)), ...references.taskIds]).slice(0, 500)
  };
}

function removeSmartListTaskReferences(
  smartList: TaskHubSmartList,
  tasks: TaskItem[]
): Pick<TaskHubSmartList, "taskStableIds" | "taskIds"> {
  const references = smartListTaskReferences(tasks);
  const stableIds = new Set(references.taskStableIds);
  const taskIds = new Set(tasks.map((task) => task.id));
  return {
    taskStableIds: uniqueStrings(smartList.taskStableIds.filter((stableId) => !stableIds.has(stableId))).slice(0, 500),
    taskIds: uniqueStrings(smartList.taskIds.filter((taskId) => !taskIds.has(taskId))).slice(0, 500)
  };
}

function smartListReferencesEqual(
  smartList: TaskHubSmartList,
  references: Pick<TaskHubSmartList, "taskStableIds" | "taskIds">
): boolean {
  return arraysEqual(smartList.taskStableIds, references.taskStableIds) &&
    arraysEqual(smartList.taskIds, references.taskIds);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

export function buildDatedNoteDayStats(tasks: readonly TaskItem[], noteDates: readonly string[] = []): Record<string, DatedNoteDayStats> {
  const statsByDate: Record<string, DatedNoteDayStats> = {};
  for (const date of noteDates) {
    statsByDate[date] = { startedCount: 0, scheduledCount: 0, completedCount: 0 };
  }

  const ensure = (date: string): DatedNoteDayStats => {
    const existing = statsByDate[date];
    if (existing) return existing;
    const created = { startedCount: 0, scheduledCount: 0, completedCount: 0 };
    statsByDate[date] = created;
    return created;
  };

  for (const task of tasks) {
    const startedDate = taskStartDateKey(task);
    if (startedDate) ensure(startedDate).startedCount += 1;

    const plannedDate = taskPlannedDateKey(task);
    if (plannedDate) ensure(plannedDate).scheduledCount += 1;

    const completedDate = taskCompletedDateKey(task);
    if (completedDate) ensure(completedDate).completedCount += 1;
  }

  return statsByDate;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

type RestoredTaskHubSessionState = {
  view: DashboardView;
  filters: TaskFilterState;
  selectedExternalListFilterId: string | undefined;
  calendarMode: CalendarViewMode;
  calendarFocusDate: Date;
  visibleSourceIds: Set<string>;
  unscheduledPanelOpen: boolean;
};

export function restoreTaskHubSessionState(
  settings: Pick<TaskHubSettings, "defaultView" | "taskViewFilters" | "lastSessionState">,
  getNow: () => Date = () => new Date()
): RestoredTaskHubSessionState {
  return {
    view: settings.lastSessionState?.view ?? settings.defaultView,
    filters: cloneTaskFilters(settings.lastSessionState?.taskViewFilters ?? settings.taskViewFilters),
    selectedExternalListFilterId: settings.lastSessionState?.selectedExternalListFilterId,
    calendarMode: settings.lastSessionState?.calendarMode ?? "month",
    calendarFocusDate: parseTaskHubSessionDate(settings.lastSessionState?.calendarFocusDate) ?? getNow(),
    visibleSourceIds: new Set(settings.lastSessionState?.visibleSourceIds?.length ? settings.lastSessionState.visibleSourceIds : ["vault"]),
    unscheduledPanelOpen: settings.lastSessionState?.unscheduledPanelOpen ?? false
  };
}

export function createTaskHubSessionSnapshot(input: {
  view: DashboardView;
  filters: TaskFilterState;
  selectedExternalListFilterId?: string;
  calendarMode: CalendarViewMode;
  calendarFocusDate: Date;
  visibleSourceIds: ReadonlySet<string>;
  unscheduledPanelOpen: boolean;
}): TaskHubLastSessionState {
  return {
    view: input.view,
    taskViewFilters: cloneTaskFilters(input.filters),
    ...(input.selectedExternalListFilterId ? { selectedExternalListFilterId: input.selectedExternalListFilterId } : {}),
    calendarMode: input.calendarMode,
    calendarFocusDate: input.calendarFocusDate.toISOString(),
    visibleSourceIds: [...input.visibleSourceIds],
    unscheduledPanelOpen: input.unscheduledPanelOpen
  };
}

function parseTaskHubSessionDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function externalTaskListFilterEntryId(
  source: ExternalTaskListFilterEntry["source"],
  externalListId: string
): string {
  return source === "apple-reminders"
    ? `apple-reminders:list:${externalListId}`
    : `dida:project:${externalListId}`;
}

function countExternalListTasks(
  tasks: readonly TaskItem[],
  source: ExternalTaskListFilterEntry["source"],
  externalListId: string,
  includeCompleted: boolean
): number {
  return tasks.filter((task) => {
    if (task.source !== source || task.externalListId !== externalListId) return false;
    if (includeCompleted) return true;
    return !task.completed;
  }).length;
}
