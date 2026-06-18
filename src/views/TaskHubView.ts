import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import { TASK_HUB_VIEW_TYPE } from "../constants";
import { toLocalDateKey } from "../calendar/dateBuckets";
import { filterTasks, type TaskFilterState } from "../filtering/filters";
import { createTranslator } from "../i18n";
import type TaskHubPlugin from "../main";
import type { TaskItem } from "../types";
import { type CalendarViewMode } from "../calendar/calendarModel";
import { renderCalendarView, type AgendaScrollPosition, type CalendarModeTransitionDirection } from "./renderCalendarView";
import { renderShell, type DashboardView } from "./renderShell";
import { syncVisibleSources } from "./sourceVisibility";
import { renderTagsView } from "./renderTagsView";
import { renderTasksView } from "./renderTasksView";
import { decorateRenderedTaskNoteTags, renderPlainTaskNoteBody } from "./renderTaskNoteBody";
import { bindTaskHubTagInputSuggest, collectObsidianTags, type TaskHubTagInputElement } from "./tagInputSuggest";

type TaskHubRenderOptions = {
  preserveTaskListScroll?: boolean;
  preserveContentScroll?: boolean;
  preserveCalendarAgendaScroll?: boolean;
};

export class TaskHubView extends ItemView {
  private view: DashboardView = this.plugin.settings.defaultView;
  private filters: TaskFilterState = cloneTaskFilters(this.plugin.settings.taskViewFilters);
  private calendarMode: CalendarViewMode = "month";
  private calendarModeTransition: CalendarModeTransitionDirection | undefined;
  private calendarFocusDate = new Date();
  private visibleSourceIds = new Set<string>(["vault"]);
  private knownCalendarSourceIds = new Set<string>(["vault"]);
  private isRefreshing = false;
  private selectedTaskId: string | undefined;
  private taskListScrollTop = 0;
  private contentScrollTop = 0;
  private calendarAgendaScrollPosition: AgendaScrollPosition | undefined;
  private completingTaskIds = new Set<string>();
  private selectedTaskIds = new Set<string>();
  private unscheduledPanelOpen = false;
  private unscheduledPanelOpening = false;
  private unscheduledPanelClosing = false;
  private unscheduledPanelCloseTimer: number | undefined;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskHubPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TASK_HUB_VIEW_TYPE;
  }

  getDisplayText(): string {
    return createTranslator(this.plugin.settings.language)("taskHub");
  }

  onOpen(): Promise<void> {
    this.render({ preserveTaskListScroll: true });
    return Promise.resolve();
  }

  render(options: TaskHubRenderOptions = {}): void {
    if (shouldPreserveScroll(options)) {
      this.captureTaskListScroll();
      this.captureContentScroll();
      this.captureCalendarAgendaScroll();
    }
    const container = this.containerEl.children[1] as HTMLElement;
    const allTasks = this.plugin.getTasks();
    const now = new Date();
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
    const bindTagInputSuggest = (input: TaskHubTagInputElement) => {
      bindTaskHubTagInputSuggest(this.plugin.app, input, () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()));
    };
    const main = renderShell(
      container,
      {
        view: this.view,
        filters: this.filters,
        availableTags: collectTags(allTasks),
        sourceFilters: taskSourceFilterOptions(allTasks, this.filters, new Date(), t),
        stats: this.plugin.taskIndex.getStats(),
        isRefreshing: this.isRefreshing,
        unscheduledPanelOpen: this.view === "calendar" && this.unscheduledPanelOpen,
        unscheduledTaskCount: unscheduledTasks.length,
        t
      },
      {
        onViewChange: (view) => {
          this.view = view;
          this.render();
        },
        onRescan: () => void this.refreshData(),
        onCreateTask: () => this.plugin.openCreateTaskModal(toLocalDateKey(new Date())),
        onUnscheduledToggle: () => {
          if (this.view !== "calendar") {
            this.openUnscheduledPanel();
            this.view = "calendar";
          } else {
            this.toggleUnscheduledPanel();
          }
          this.render();
        },
        onStatusChange: (status) => {
          this.updateFilters({ ...this.filters, status });
        },
        onConditionChange: (conditions) => {
          this.updateFilters({ ...this.filters, conditions });
        },
        onSourceFilterChange: (source) => {
          this.updateFilters({ ...this.filters, sourceQuery: source === "all" ? "" : source });
        },
        onTextQueryChange: (textQuery) => {
          this.updateFilters({ ...this.filters, textQuery });
        }
      },
      { bindTagInputSuggest }
    );

    if (this.view === "tasks") {
      const now = new Date();
      const visibleTasks = this.taskViewVisibleTasks(allTasks, now);
      if (visibleTasks.length > 0 && !visibleTasks.some((task) => task.id === this.selectedTaskId)) {
        this.selectedTaskId = undefined;
      }
      this.pruneSelectedTaskIds(visibleTasks);
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
              tags: this.filters.tags.includes(tag)
                ? this.filters.tags.filter((existing) => existing !== tag)
                : [...this.filters.tags, tag]
            }, { preserveTaskListScroll: true });
          },
          onSourceSelect: (source) => {
            this.updateFilters({ ...this.filters, sourceQuery: source === "all" ? "" : source });
          },
          onAppleReminderListChange: (task, listId) => void this.plugin.moveAppleReminderToList(task, listId),
          onDidaProjectChange: (task, projectId) => void this.plugin.moveDidaTaskToProject(task, projectId),
          onTaskUpdate: (task, draft) => void this.plugin.updateCalendarTask(task, draft),
          onTaskDelete: (task) => void this.plugin.deleteCalendarTask(task),
          onSendToTarget: (task, target) => void this.plugin.sendTaskToTarget(task, target),
          onCreateTaskNote: (task) => void this.plugin.createTaskNoteForTask(task),
          onOpenTaskNote: (path) => void this.plugin.openTaskNote(path),
          onDeleteTaskNote: (path) => void this.plugin.deleteTaskNote(path),
          onOpenTaskNoteInThino: (path) => void this.plugin.openTaskNoteSource(path)
        },
        now,
        t,
        {
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.canCreateAppleReminders(),
          allowDidaWriteback: this.plugin.settings.dida.tasksWritebackEnabled,
          allowDidaCreate: this.plugin.canCreateDidaTasks(),
          allowDidaDelete: this.plugin.settings.dida.tasksDeleteEnabled,
          allowAppleCalendarReminderConversion:
            this.plugin.settings.localApple.calendarReminderConversionEnabled && this.plugin.canConvertAppleCalendarAndReminders(),
          appleReminderLists: this.plugin.getAppleReminderLists(),
          didaProjects: this.plugin.getDidaProjects(),
          taskSendDefaultTarget: this.plugin.defaultTaskSendTarget(),
          selectedTaskId: this.selectedTaskId,
          selectedTaskIds: this.selectedTaskIds,
          sourceColors,
          taskColors,
          bindTagInputSuggest,
          taskListScrollTop: this.taskListScrollTop,
          exitingTaskIds: this.exitingTaskIds(allTasks),
          taskNotesEnabled: this.plugin.settings.taskNotes.enabled,
          allowThinoNoteEdit: this.plugin.settings.taskNotes.thinoIntegrationEnabled,
          getTaskNoteCount: (task) =>
            this.plugin.settings.taskNotes.showCountsInTaskList ? this.plugin.getTaskNoteCount(task) : 0,
          getTaskNotes: (task) => this.plugin.getTaskNotes(task),
          renderNoteMarkdown: (noteContainer, body, sourcePath) => this.renderNoteMarkdown(noteContainer, body, sourcePath)
        }
      );
      this.restoreContentScroll(options);
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
            this.updateFilters({ ...this.filters, tags: [tag] });
          },
          onTaskComplete: (task) => void this.completeTaskFromView(task),
          onTaskSelect: (task) => {
            this.view = "tasks";
            this.selectedTaskId = task.id;
            this.selectedTaskIds = new Set([task.id]);
            this.updateFilters({ ...this.filters, tags: [] });
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
            this.render();
          },
          onMove: (direction) => {
            this.calendarFocusDate = moveDate(this.calendarFocusDate, this.calendarMode, direction);
            this.render();
          },
          onToday: () => {
            this.calendarFocusDate = new Date();
            this.render();
          },
          onTimeScaleChange: (scale) => {
            this.plugin.settings.calendarTimeScale = scale;
            void this.plugin.saveSettings().then(() => this.render());
          },
          onLayerToggle: (sourceId) => {
            this.visibleSourceIds = toggleSetValue(this.visibleSourceIds, sourceId);
            this.render();
          },
          onDateCreateTask: (dateKey) => this.plugin.openCreateTaskModal(dateKey),
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
          onEventReschedule: (event, dateKey) => void this.withPreservedCalendarViewport(() => this.plugin.rescheduleCalendarEvent(event, dateKey)),
          onEventUpdate: (event, draft) => void this.withPreservedCalendarViewport(() => this.plugin.updateCalendarEvent(event, draft)),
          onEventDelete: (event) => void this.withPreservedCalendarViewport(() => this.plugin.deleteCalendarEvent(event)),
          onEventSendToAppleReminders: (event) => void this.withPreservedCalendarViewport(() => this.plugin.convertAppleCalendarEventToReminder(event)),
          onCreateTaskNote: (task) => void this.plugin.createTaskNoteForTask(task),
          onCreateEventNote: (event) => void this.plugin.createTaskNoteForEvent(event),
          onOpenTaskNote: (path) => void this.plugin.openTaskNote(path),
          onDeleteTaskNote: (path) => void this.plugin.deleteTaskNote(path),
          onOpenTaskNoteInThino: (path) => void this.plugin.openTaskNoteSource(path)
        }
      );
      this.unscheduledPanelOpening = false;
      this.calendarModeTransition = undefined;
      this.restoreContentScroll(options);
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

  private taskViewVisibleTasks(allTasks: TaskItem[], now: Date): TaskItem[] {
    const visibleTasks = filterTasks(allTasks, this.filters, now);
    if (this.filters.status !== "open" || this.completingTaskIds.size === 0) {
      return visibleTasks;
    }

    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    const exitingTasks = allTasks.filter((task) => {
      if (!this.completingTaskIds.has(task.id) || visibleIds.has(task.id) || !task.completed) return false;
      return filterTasks([task], { ...this.filters, status: "all" }, now).length > 0;
    });
    return [...visibleTasks, ...exitingTasks];
  }

  private pruneSelectedTaskIds(visibleTasks: TaskItem[]): void {
    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    this.selectedTaskIds = new Set([...this.selectedTaskIds].filter((taskId) => visibleIds.has(taskId)));
    if (this.selectedTaskId && !visibleIds.has(this.selectedTaskId)) {
      this.selectedTaskId = undefined;
    }
  }

  private updateTaskSelection(task: TaskItem, taskIds?: string[]): void {
    this.selectedTaskId = task.id;
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
      left: agenda.scrollLeft
    };
  }

  private restoreContentScroll(options: TaskHubRenderOptions): void {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    restoreContentScrollAfterRender(container, {
      preserveScroll: shouldPreserveScroll(options),
      scrollTop: this.contentScrollTop
    });
  }

  private async withPreservedCalendarViewport<T>(action: () => Promise<T>): Promise<T> {
    this.captureContentScroll();
    this.captureCalendarAgendaScroll();
    return action();
  }

  private updateFilters(filters: TaskFilterState, options: TaskHubRenderOptions = {}): void {
    this.filters = cloneTaskFilters(filters);
    this.plugin.settings.taskViewFilters = cloneTaskFilters(this.filters);
    void this.plugin.saveSettings();
    this.render(options);
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

export function restoreContentScrollAfterRender(
  container: HTMLElement | undefined,
  options: { preserveScroll?: boolean; scrollTop: number }
): void {
  if (!options.preserveScroll || !container) return;
  container.scrollTop = options.scrollTop;
}

function shouldPreserveScroll(options: TaskHubRenderOptions): boolean {
  return Boolean(options.preserveTaskListScroll || options.preserveContentScroll || options.preserveCalendarAgendaScroll);
}

export function collectUnscheduledTasks(
  tasks: TaskItem[],
  filters: TaskFilterState,
  now: Date,
  canScheduleTask: (task: TaskItem) => boolean
): TaskItem[] {
  return filterTasks(tasks, filters, now)
    .filter((task) => !task.dueDate && canScheduleTask(task))
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
    if (!completingTaskIds.has(task.id) || visibleIds.has(task.id) || !task.completed || task.dueDate || !canScheduleTask(task)) return false;
    return filterTasks([task], { ...filters, status: "all" }, now).length > 0;
  });
  return [...visible, ...exiting].sort(compareUnscheduledTasks);
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
