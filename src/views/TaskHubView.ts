import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { TASK_HUB_VIEW_TYPE } from "../constants";
import { filterTasks, sortTasksByCompletion, type TaskFilterState } from "../filtering/filters";
import { createTranslator } from "../i18n";
import type TaskHubPlugin from "../main";
import type { TaskItem } from "../types";
import { type CalendarViewMode } from "../calendar/calendarModel";
import { renderCalendarView } from "./renderCalendarView";
import { renderShell, type DashboardView } from "./renderShell";
import { syncVisibleSources } from "./sourceVisibility";
import { renderTagsView } from "./renderTagsView";
import { renderTasksView } from "./renderTasksView";

export class TaskHubView extends ItemView {
  private view: DashboardView = this.plugin.settings.defaultView;
  private filters: TaskFilterState = {
    status: this.plugin.settings.showCompletedByDefault ? "all" : "open",
    tags: [],
    sourceQuery: "",
    textQuery: ""
  };
  private calendarMode: CalendarViewMode = "month";
  private calendarFocusDate = new Date();
  private visibleSourceIds = new Set<string>(["vault"]);
  private knownCalendarSourceIds = new Set<string>(["vault"]);
  private isRefreshing = false;
  private selectedTaskId: string | undefined;
  private taskListScrollTop = 0;

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

  render(options: { preserveTaskListScroll?: boolean } = {}): void {
    if (options.preserveTaskListScroll) {
      this.captureTaskListScroll();
    }
    const container = this.containerEl.children[1] as HTMLElement;
    const allTasks = this.plugin.getTasks();
    const calendarSources = this.plugin.getCalendarSources();
    const calendarSourceIds = ["vault", ...calendarSources.map((source) => source.id)];
    syncVisibleSources(this.visibleSourceIds, this.knownCalendarSourceIds, calendarSourceIds);
    const t = createTranslator(this.plugin.settings.language);
    const sourceColors = {
      vault: "var(--interactive-accent)",
      "apple-reminders": this.plugin.settings.localApple.remindersColor
    };
    const main = renderShell(
      container,
      {
        view: this.view,
        filters: this.filters,
        availableTags: collectTags(allTasks),
        stats: this.plugin.taskIndex.getStats(),
        isRefreshing: this.isRefreshing,
        t
      },
      {
        onViewChange: (view) => {
          this.view = view;
          this.render();
        },
        onRescan: () => void this.refreshData(),
        onStatusChange: (status) => {
          this.filters = { ...this.filters, status };
          this.render();
        },
        onConditionChange: (conditions) => {
          this.filters = { ...this.filters, conditions };
          this.render();
        },
        onTextQueryChange: (textQuery) => {
          this.filters = { ...this.filters, textQuery };
          this.render();
        }
      }
    );

    if (this.view === "tasks") {
      const visibleTasks = filterTasks(allTasks, this.filters, new Date());
      if (visibleTasks.length > 0 && !visibleTasks.some((task) => task.id === this.selectedTaskId)) {
        this.selectedTaskId = sortTasksByCompletion(visibleTasks)[0].id;
      }
      renderTasksView(
        main,
        visibleTasks,
        allTasks,
        this.filters,
        {
          onComplete: (task) => void this.plugin.completeTask(task),
          onJump: (task) => void this.plugin.jumpToTask(task),
          onSendToAppleReminders: (task) => void this.plugin.sendTaskToAppleReminders(task),
          onSelect: (task) => {
            this.selectedTaskId = task.id;
            this.render();
          },
          onTagSelect: (tag) => {
            this.filters = {
              ...this.filters,
              tags: this.filters.tags.includes(tag)
                ? this.filters.tags.filter((existing) => existing !== tag)
                : [...this.filters.tags, tag]
            };
            this.render();
          },
          onTagQueryChange: (tagQuery) => {
            this.filters = { ...this.filters, tagQuery };
            this.render();
          },
          onSourceSelect: (source) => {
            this.filters = { ...this.filters, sourceQuery: source === "all" ? "" : source };
            this.render();
          },
          onAppleReminderListChange: (task, listId) => void this.plugin.moveAppleReminderToList(task, listId)
        },
        new Date(),
        t,
        {
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.settings.localApple.remindersCreateEnabled,
          appleReminderLists: this.plugin.getAppleReminderLists(),
          selectedTaskId: this.selectedTaskId,
          sourceColors,
          taskListScrollTop: this.taskListScrollTop
        }
      );
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
            this.filters = { ...this.filters, tags: [tag] };
            this.render();
          },
          onTaskComplete: (task) => void this.plugin.completeTask(task),
          onTaskSelect: (task) => {
            this.view = "tasks";
            this.selectedTaskId = task.id;
            this.filters = { ...this.filters, tags: [] };
            this.render();
          },
          onReorderTags: (sourceTag, targetTag) => {
            void this.reorderTagCards(sourceTag, targetTag);
          }
        },
        t,
        {
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          orderedTags: this.plugin.settings.tagViewOrder,
          sourceColors
        }
      );
      return;
    }

    if (this.view === "calendar") {
      renderCalendarView(
        main,
        {
          mode: this.calendarMode,
          focusDate: this.calendarFocusDate,
          weekStart: this.plugin.settings.weekStart,
          visibleSourceIds: this.visibleSourceIds,
          includeCompletedTasks: this.filters.status !== "open",
          allowAppleReminderWriteback: this.plugin.settings.localApple.remindersWritebackEnabled,
          allowAppleReminderCreate: this.plugin.canCreateAppleReminders(),
          allowAppleCalendarWriteback: this.plugin.settings.localApple.calendarWritebackEnabled,
          allowTaskCreation: this.plugin.settings.calendarTaskCreationEnabled,
          showLunarCalendar: this.plugin.settings.language === "zh" && this.plugin.settings.showLunarCalendar,
          defaultTimedTaskDurationMinutes: this.plugin.settings.localApple.calendarDefaultTimedTaskDurationMinutes,
          taskDurationOverrides: this.plugin.settings.localApple.reminderDurationOverrides,
          appleReminderLists: this.plugin.getAppleReminderLists(),
          appleCalendars: this.plugin.getAppleCalendars(),
          sources: calendarSources,
          t
        },
        allTasks,
        this.plugin.getCalendarEvents(),
        {
          onModeChange: (mode) => {
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
          onLayerToggle: (sourceId) => {
            this.visibleSourceIds = toggleSetValue(this.visibleSourceIds, sourceId);
            this.render();
          },
          onDateCreateTask: (dateKey) => this.plugin.openCreateTaskModal(dateKey),
          onTaskComplete: (task) => void this.plugin.completeTask(task),
          onTaskJump: (task) => void this.plugin.jumpToTask(task),
          onTaskSelect: (task) => {
            this.selectedTaskId = task.id;
            this.render();
          },
          onTaskUpdate: (task, draft) => void this.plugin.updateCalendarTask(task, draft),
          onTaskReschedule: (task, dateKey) => void this.plugin.rescheduleTask(task, dateKey),
          onTaskDelete: (task) => void this.plugin.deleteCalendarTask(task),
          onTaskSendToAppleReminders: (task) => void this.plugin.sendTaskToAppleReminders(task),
          onEventReschedule: (event, dateKey) => void this.plugin.rescheduleCalendarEvent(event, dateKey),
          onEventUpdate: (event, draft) => void this.plugin.updateCalendarEvent(event, draft),
          onEventDelete: (event) => void this.plugin.deleteCalendarEvent(event)
        }
      );
      return;
    }

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

  private captureTaskListScroll(): void {
    if (this.view !== "tasks") return;
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const list = container ? findTaskListPane(container) : undefined;
    this.taskListScrollTop = list?.scrollTop ?? this.taskListScrollTop;
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

function findTaskListPane(container: HTMLElement): HTMLElement | undefined {
  return container.querySelector<HTMLElement>(".task-hub-task-list-pane") ?? undefined;
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

function toggleSetValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
