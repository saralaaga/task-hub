import { Menu, setIcon, setTooltip } from "obsidian";
import { buildCalendarItems, calendarEventLayerId, getCalendarRange, type CalendarItem, type CalendarViewMode } from "../calendar/calendarModel";
import type { CalendarDropTarget } from "../calendar/calendarDropTarget";
import { toLocalDateKey } from "../calendar/dateBuckets";
import { formatLunarDayLabel, formatLunarMonthTitle } from "../calendar/lunarCalendar";
import type { TranslationKey, Translator } from "../i18n";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "../reminderAlerts";
import type { TaskNote } from "../taskNotes";
import { parseTaskSendTarget, preferredTaskSendTarget, taskSendTargetOptions } from "../taskSendTargets";
import { taskPlannedDateKey } from "../taskDates";
import type { AppleCalendarInfo, AppleReminderList, CalendarEvent, CalendarItemEditDraft, CalendarSource, CalendarSourceStatus, CalendarTimeScale, DidaProject, TaskItem, TaskSendTarget, WeekStart } from "../types";
import { canDeleteAppleCalendarEventCapability, canDeleteAppleReminderCapability } from "../integrationCapabilities";
import {
  addSourceIndicatorMenuItem,
  deleteLabelForEvent,
  deleteLabelForTask,
  deleteLabelForTaskBulkAction,
  sourceIndicatorLabelForEvent,
  sourceIndicatorLabelForTask
} from "./contextMenuLabels";
import { renderTaskNoteBody, taskNotePreviewBody, taskNotePreviewTitle, type TaskNoteMarkdownRenderer } from "./renderTaskNoteBody";
import { recurrencePresetFromRule } from "../recurrence";
import { MIN_TIME_GRANULARITY_MINUTES, snapDayStartMinutes, snapToTimeGranularity, validTimedDurationMinutes } from "../timeGranularity";
import type { TaskListDropPosition } from "../taskListOrdering";
import { createRecurrenceSelect, recurrenceValueFromSelect } from "./recurrenceControls";
import { resolveTaskBulkActions, type TaskBulkActionId } from "./taskSelection";
import { renderSourceLogo, sourceLogoKindForCalendarItem } from "./sourceLogos";
import { setCssProps, setCssStyles } from "./domStyles";
import type { TaskHubTagInputElement } from "./tagInputSuggest";
import { renderTaskDetails, type TaskRenderOptions, type TaskRowHandlers } from "./renderTasksView";

export type CalendarViewState = {
  mode: CalendarViewMode;
  modeTransition?: CalendarModeTransitionDirection;
  calendarAgendaScrollPosition?: AgendaScrollPosition;
  focusDate: Date;
  weekStart: WeekStart;
  visibleSourceIds: Set<string>;
  includeCompletedTasks: boolean;
  localAppleEnabled?: boolean;
  localAppleSupported?: boolean;
  localAppleRemindersEnabled?: boolean;
  localAppleCalendarEnabled?: boolean;
  allowAppleReminderWriteback: boolean;
  allowAppleReminderCreate?: boolean;
  allowDidaWriteback?: boolean;
  allowDidaDragReschedule?: boolean;
  allowDidaDelete?: boolean;
  allowDidaCreate?: boolean;
  allowAppleCalendarWriteback?: boolean;
  allowAppleCalendarReminderConversion?: boolean;
  allowTaskCreation: boolean;
  showLunarCalendar?: boolean;
  calendarTimeScale?: CalendarTimeScale;
  calendarDayStartHour?: number;
  calendarDayEndHour?: number;
  today?: Date;
  defaultTimedTaskDurationMinutes?: number;
  taskDurationOverrides?: Record<string, number>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  didaProjects?: DidaProject[];
  taskSendDefaultTarget?: TaskSendTarget;
  appleCalendars?: AppleCalendarInfo[];
  bindTagInputSuggest?: (input: TaskHubTagInputElement) => void;
  taskNotesEnabled?: boolean;
  allowThinoNoteEdit?: boolean;
  getTaskNotes?: (task: TaskItem) => TaskNote[];
  getEventNotes?: (event: CalendarEvent) => TaskNote[];
  renderNoteMarkdown?: TaskNoteMarkdownRenderer;
  selectedTaskIds?: ReadonlySet<string>;
  completingTaskIds?: ReadonlySet<string>;
  unscheduledPanelOpen?: boolean;
  unscheduledPanelOpening?: boolean;
  unscheduledPanelClosing?: boolean;
  unscheduledTasks?: TaskItem[];
  sources: CalendarSource[];
  t: Translator;
};

export type CalendarModeTransitionDirection = "left" | "right";

export type CalendarViewHandlers = {
  onModeChange: (mode: CalendarViewMode) => void;
  onMove: (direction: -1 | 1) => void;
  onToday: () => void;
  onFocusDateChange?: (date: Date) => void;
  onLayerToggle: (sourceId: string) => void;
  onDateCreateTask: (target: CalendarDropTarget) => void;
  onTaskComplete: (task: TaskItem) => void;
  onTaskJump: (task: TaskItem) => void;
  onTaskSelect: (task: TaskItem) => void;
  onTaskSelectionChange?: (task: TaskItem, taskIds: string[]) => void;
  onTaskUpdate?: (task: TaskItem, draft: Extract<CalendarItemEditDraft, { kind: "task" }>) => void;
  onTaskReschedule: (task: TaskItem, target: CalendarDropTarget) => void;
  onTaskDelete?: (task: TaskItem) => void;
  onTaskSendToAppleReminders?: (task: TaskItem) => void;
  onTaskSendToDida?: (task: TaskItem) => void;
  onTaskSendToTarget?: (task: TaskItem, target: TaskSendTarget) => void;
  onCreateTaskNote?: (task: TaskItem) => void;
  onEventReschedule?: (event: CalendarEvent, target: CalendarDropTarget) => void;
  onEventUpdate?: (event: CalendarEvent, draft: Extract<CalendarItemEditDraft, { kind: "event" }>) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onEventSendToAppleReminders?: (event: CalendarEvent) => void;
  onCreateEventNote?: (event: CalendarEvent) => void;
  onOpenTaskNote?: (path: string) => void;
  onDeleteTaskNote?: (path: string) => void;
  onOpenTaskNoteSource?: (path: string) => void;
  onOpenTaskNoteInThino?: (path: string) => void;
  onTaskSendToAppleCalendar?: (task: TaskItem) => void;
  onAppleReminderListChange?: (task: TaskItem, listId: string) => void;
  onTaskNoteReorder?: (task: TaskItem, draggedNote: TaskNote, anchorNote: TaskNote, position: TaskListDropPosition) => void;
  onToggleTaskNotePinned?: (task: TaskItem, note: TaskNote) => void;
  onTimeScaleChange?: (scale: CalendarTimeScale) => void;
};

const MODE_LABEL_KEYS: Record<CalendarViewMode, TranslationKey> = {
  day: "day",
  week: "week",
  month: "month"
};
const HOUR_HEIGHT = 56;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const CALENDAR_TIME_SCALES: CalendarTimeScale[] = ["fit", "hour", "half", "quarter"];
const HOUR_HEIGHT_BY_SCALE: Record<Exclude<CalendarTimeScale, "fit">, number> = {
  hour: HOUR_HEIGHT,
  half: 84,
  quarter: 112
};
const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;
const TASK_TIME_POINT_HEIGHT = 28;
const TASK_TIME_POINT_GAP = 4;
const MIN_TIMED_ITEM_DURATION_MINUTES = MIN_TIME_GRANULARITY_MINUTES;
const TIME_SCALE_WHEEL_STEP_THRESHOLD = 2;
const CALENDAR_ITEM_DRAG_MIME = "application/x-task-hub-calendar-item-id";
const TASK_DRAG_MIME = "application/x-task-hub-task-id";
let activeDraggedCalendarItemId: string | undefined;
let activeDragGrabOffsetMinutes = 0;
let activeDragGrabOffsetXPixels = 0;
let activeDragGrabOffsetYPixels = 0;
let activeDraggedElementReference: HTMLElement | undefined;
let activeDragFeedbackElement: HTMLElement | undefined;
let activeDragStackElement: HTMLElement | undefined;
let activeMutedDragElements: HTMLElement[] = [];
let activeDetailsElement: HTMLElement | undefined;
let activeDetailsCleanup: (() => void) | undefined;
let activeDetailsSelectionKey: string | undefined;
let activeSelectedCalendarItemKey: string | undefined;
let activeSelectedTaskIds = new Set<string>();
let activeSelectedCalendarItemKeys = new Set<string>();
let activeCalendarItemElements = new Map<string, Set<HTMLElement>>();
let activeDaySidebarHost: HTMLElement | undefined;
type MiniMonthDayStats = {
  taskCount: number;
  completedTaskCount: number;
  eventCount: number;
};
let activeDaySidebarContext:
  | {
      day: string;
      dayItems: CalendarItem[];
      miniMonthStats: Map<string, MiniMonthDayStats>;
      state: CalendarViewState;
      handlers: CalendarViewHandlers;
    }
  | undefined;
let suppressNextTimedCreationClick = false;
const WEEK_START_DAY_INDEX: Record<WeekStart, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

type TimedItemLayout = {
  columnIndex: number;
  columnCount: number;
  overlapIndex?: number;
  overlapCount?: number;
  overlapItems?: CalendarItem[];
  isOverlapRepresentative?: boolean;
};

type TimedLayoutCandidate = {
  item: CalendarItem;
  startMinutes: number;
  visualStart: number;
  visualEnd: number;
  overlapIndex: number;
  overlapCount: number;
};

type AgendaTimeMetrics = {
  hourHeight: number;
  minorStepMinutes: 120 | 60 | 30 | 15;
};

type ResizePreviewStyles = {
  top: string;
  height: string;
};

export function renderCalendarView(
  container: HTMLElement,
  state: CalendarViewState,
  tasks: TaskItem[],
  events: CalendarEvent[],
  handlers: CalendarViewHandlers
): void {
  const detailsSelectionKeyToRestore = activeDetailsSelectionKey;
  if (activeDetailsElement) clearActiveCalendarDetails(true);
  activeDaySidebarHost = undefined;
  activeDaySidebarContext = undefined;
  const agendaScrollToRestore = state.calendarAgendaScrollPosition ?? readAgendaScrollPosition(container);
  activeCalendarItemElements = new Map();
  activeSelectedTaskIds = new Set(state.selectedTaskIds ?? []);
  activeSelectedCalendarItemKeys = new Set([...activeSelectedTaskIds].map((taskId) => `task:${taskId}`));
  container.empty();
  const today = toLocalDateKey(state.today ?? new Date());
  const range = getCalendarRange(state.mode, state.focusDate, state.weekStart);
  const isTodayVisible = today >= range.start && today <= range.end;

  const controls = container.createDiv({ cls: "task-hub-calendar-controls" });
  for (const mode of ["day", "week", "month"] as CalendarViewMode[]) {
    const button = controls.createEl("button", { cls: state.mode === mode ? "mod-cta" : "", text: state.t(MODE_LABEL_KEYS[mode]) });
    button.addEventListener("click", () => handlers.onModeChange(mode));
  }
  const previousButton = controls.createEl("button", { cls: "task-hub-calendar-arrow", text: "‹" });
  previousButton.setAttr("aria-label", state.t("previous"));
  previousButton.addEventListener("click", () => handlers.onMove(-1));
  const todayButton = controls.createEl("button", {
    cls: `task-hub-calendar-today-button ${isTodayVisible ? "is-current-range" : ""}`,
    text: state.t("today")
  });
  todayButton.addEventListener("click", handlers.onToday);
  const nextButton = controls.createEl("button", { cls: "task-hub-calendar-arrow", text: "›" });
  nextButton.setAttr("aria-label", state.t("next"));
  nextButton.addEventListener("click", () => handlers.onMove(1));
  controls.createDiv({ cls: "task-hub-calendar-title", text: calendarTitle(state.focusDate, state.mode, state.t, state.showLunarCalendar) });

  const layers = controls.createEl("details", { cls: "task-hub-layer-menu" });
  const layerSummary = layers.createEl("summary", { text: state.t("layers") });
  layerSummary.createSpan({ cls: "task-hub-layer-count", text: String(state.visibleSourceIds.size) });
  const layerList = layers.createDiv({ cls: "task-hub-layer-list" });
  renderLayerToggle(layerList, "vault", state.t("vaultTasks"), state.visibleSourceIds.has("vault"), handlers);
  for (const source of state.sources) {
    renderLayerToggle(
      layerList,
      source.id,
      `${source.name} (${sourceStatusLabel(source, state.t)})`,
      state.visibleSourceIds.has(source.id),
      handlers
    );
  }

  const items = buildCalendarItems({
    tasks,
    events,
    visibleSourceIds: state.visibleSourceIds,
    includeCompletedTasks: state.includeCompletedTasks,
    sourceColors: Object.fromEntries(state.sources.map((source) => [source.id, source.color])),
    eventColors: Object.fromEntries(events.filter((event) => event.sourceId === "apple-calendar" && event.calendarId).map((event) => [event.calendarId as string, appleCalendarEventColor(event, state)])),
    taskColors: state.taskColors,
    taskDurationOverrides: state.taskDurationOverrides
  });
  const miniMonthStats =
    state.mode === "day"
      ? buildMiniMonthStats(buildCalendarItems({
          tasks,
          events,
          visibleSourceIds: state.visibleSourceIds,
          includeCompletedTasks: true,
          sourceColors: Object.fromEntries(state.sources.map((source) => [source.id, source.color])),
          eventColors: Object.fromEntries(events.filter((event) => event.sourceId === "apple-calendar" && event.calendarId).map((event) => [event.calendarId as string, appleCalendarEventColor(event, state)])),
          taskColors: state.taskColors,
          taskDurationOverrides: state.taskDurationOverrides
        }), tasks, state.visibleSourceIds)
      : new Map<string, MiniMonthDayStats>();
  const visibleItems = items.filter((item) => item.date >= range.start && item.date <= range.end);

  const transitionClass = state.modeTransition ? `is-slide-${state.modeTransition}` : "";
  const viewStage = container.createDiv({
    cls: ["task-hub-calendar-view-stage", transitionClass].filter(Boolean).join(" ")
  });
  const showUnscheduledPanel = state.unscheduledPanelOpen || state.unscheduledPanelClosing;
  const sidebarStateClass = state.unscheduledPanelClosing
    ? "is-unscheduled-closing"
    : state.unscheduledPanelOpening
      ? "is-unscheduled-opening"
      : "is-unscheduled-open";
  const showDaySidebar = state.mode === "day";
  const calendarHost =
    showDaySidebar
      ? viewStage.createDiv({ cls: "task-hub-calendar-day-layout" })
      : showUnscheduledPanel
        ? viewStage.createDiv({ cls: `task-hub-calendar-with-sidebar ${sidebarStateClass}` })
        : viewStage;
  const calendarPane =
    showDaySidebar || showUnscheduledPanel
      ? calendarHost.createDiv({ cls: "task-hub-calendar-pane" })
      : viewStage;

  if (visibleItems.length === 0) {
    calendarPane.createDiv({ cls: "task-hub-empty", text: state.t("calendarEmpty") });
  }

  if (state.mode === "day" || state.mode === "week") {
    if (state.mode === "day") primeDaySidebarSelection(visibleItems.filter((item) => item.date === range.days[0]));
    renderAgendaGrid(calendarPane, state, range.days, visibleItems, handlers, today);
    restoreAgendaScrollPosition(calendarPane, agendaScrollToRestore);
    if (state.mode === "day") {
      const daySidebar = calendarHost.createEl("aside", { cls: "task-hub-calendar-day-sidebar" });
      const dayItems = visibleItems.filter((item) => item.date === range.days[0]);
      activeDaySidebarHost = daySidebar;
      activeDaySidebarContext = { day: range.days[0], dayItems, miniMonthStats, state, handlers };
      renderCalendarDaySidebar(daySidebar, range.days[0], dayItems, miniMonthStats, state, handlers);
    }
    if (state.mode === "week" && showUnscheduledPanel) renderUnscheduledPanel(calendarHost, state, handlers);
    if (state.mode === "week") restoreCalendarDetailsPopover(detailsSelectionKeyToRestore, handlers, state);
    return;
  }

  renderMonthGrid(calendarPane, state, range.days, visibleItems, handlers, today);
  if (showUnscheduledPanel) renderUnscheduledPanel(calendarHost, state, handlers);
  restoreCalendarDetailsPopover(detailsSelectionKeyToRestore, handlers, state);
}

export type AgendaScrollPosition = {
  top: number;
  left: number;
};

function readAgendaScrollPosition(container: HTMLElement): AgendaScrollPosition | undefined {
  const agenda = container.querySelector?.(".task-hub-agenda") as HTMLElement | null | undefined;
  if (!agenda) return undefined;
  return {
    top: agenda.scrollTop,
    left: agenda.scrollLeft
  };
}

function restoreAgendaScrollPosition(container: HTMLElement, position: AgendaScrollPosition | undefined): void {
  if (!position) return;
  const agenda = container.querySelector?.(".task-hub-agenda") as HTMLElement | null | undefined;
  if (!agenda) return;
  agenda.scrollTop = position.top;
  agenda.scrollLeft = position.left;
}

function renderMonthGrid(
  container: HTMLElement,
  state: CalendarViewState,
  days: string[],
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  today: string
): void {
  const leadingPlaceholders = monthLeadingPlaceholderCount(days[0], state.weekStart);
  const grid = container.createDiv({ cls: "task-hub-calendar-grid task-hub-calendar-month" });

  for (let index = 0; index < leadingPlaceholders; index += 1) {
    const placeholder = grid.createDiv({ cls: "task-hub-calendar-day-placeholder" });
    placeholder.setAttr("aria-hidden", "true");
  }
  for (const day of days) {
    const dayItems = visibleItems.filter((candidate) => candidate.date === day);
    const taskCount = dayItems.filter((item) => item.kind === "task").length;
    const eventCount = dayItems.length - taskCount;
    const dayDate = new Date(`${day}T00:00:00`);
    const classes = [
      "task-hub-calendar-day",
      day === today ? "is-today" : "",
      dayItems.length === 0 ? "is-empty" : "has-items"
    ].filter(Boolean).join(" ");
    const cell = grid.createDiv({ cls: classes });
    bindTaskCreation(cell, monthCreationTarget(day), state, handlers);
    bindCalendarDropTarget(cell, day, visibleItems, handlers, state);
    const header = cell.createDiv({ cls: "task-hub-calendar-date" });
    header.createSpan({ cls: "task-hub-calendar-weekday", text: shortWeekday(dayDate, state.t) });
    header.createSpan({ cls: "task-hub-calendar-day-number", text: String(dayDate.getDate()) });
    if (state.showLunarCalendar) {
      const lunarDay = formatLunarDayLabel(dayDate);
      if (lunarDay) header.createSpan({ cls: "task-hub-calendar-lunar-day", text: lunarDay });
    }
    if (dayItems.length > 0) {
      header.createSpan({ cls: "task-hub-calendar-count", text: itemSummary(taskCount, eventCount, state.t) });
    }

    const itemArea = cell.createDiv({ cls: "task-hub-calendar-day-items" });
    for (const item of dayItems) {
      renderCalendarItem(itemArea, item, handlers, state);
    }
    bindHiddenItemCount(itemArea);
  }
}

function appleCalendarEventColor(event: CalendarEvent, state: CalendarViewState): string {
  const appleSource = state.sources.find((source) => source.id === calendarEventLayerId(event) || source.id === "apple-calendar");
  return event.calendarColor ?? appleSource?.color ?? "#6f94b8";
}

function monthLeadingPlaceholderCount(firstDay: string, weekStart: WeekStart): number {
  const firstDate = new Date(`${firstDay}T00:00:00`);
  const weekStartIndex = WEEK_START_DAY_INDEX[weekStart];
  return (firstDate.getDay() - weekStartIndex + 7) % 7;
}

function renderAgendaGrid(
  container: HTMLElement,
  state: CalendarViewState,
  days: string[],
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  today: string
): void {
  const timedItems = visibleItems.filter((item) => !item.allDay && item.startMinutes !== undefined);
  const configuredStartHour = validCalendarDayStartHour(state.calendarDayStartHour);
  const configuredEndHour = validCalendarDayEndHour(state.calendarDayEndHour, configuredStartHour);
  const startHour = Math.min(configuredStartHour, ...timedItems.map((item) => Math.floor((item.startMinutes ?? 0) / 60)));
  const endHour = Math.max(
    configuredEndHour,
    ...timedItems.map((item) => Math.ceil(((item.endMinutes ?? (item.startMinutes ?? 0) + 60) || 60) / 60))
  );
  const hourCount = Math.max(1, endHour - startHour);
  const timeScale = state.calendarTimeScale ?? "hour";
  const agenda = container.createDiv({ cls: `task-hub-agenda task-hub-agenda-${state.mode} is-scale-${timeScale}` });
  const metrics = agendaTimeMetrics(state, hourCount, container);
  setCssProps(agenda, {
    "--task-hub-agenda-days": String(days.length),
    "--task-hub-agenda-hours": String(hourCount),
    "--task-hub-hour-height": `${metrics.hourHeight}px`
  });
  bindAgendaTimeScaleWheel(agenda, state, handlers);

  const corner = agenda.createDiv({ cls: "task-hub-agenda-corner" });
  corner.createSpan({ text: state.t("today") });

  for (const day of days) {
    renderAgendaDayHeader(agenda, day, visibleItems.filter((item) => item.date === day), day === today, state, handlers);
  }

  const allDayLabel = agenda.createDiv({ cls: "task-hub-agenda-all-day-label", text: state.t("allDay") });
  allDayLabel.setAttr("aria-hidden", "true");
  for (const day of days) {
    const allDayItems = visibleItems.filter((item) => item.date === day && (item.allDay || item.startMinutes === undefined));
    const slot = agenda.createDiv({ cls: "task-hub-agenda-all-day-slot" });
    bindTaskCreation(slot, day, state, handlers);
    bindCalendarDropTarget(slot, day, visibleItems, handlers, state);
    for (const item of allDayItems) {
      renderCalendarItem(slot, item, handlers, state);
    }
    bindHiddenItemCount(slot);
  }

  const timeAxis = agenda.createDiv({ cls: "task-hub-agenda-time-axis" });
  for (let hour = startHour; hour <= endHour; hour += 1) {
    timeAxis.createDiv({ cls: "task-hub-agenda-time-label", text: formatHour(hour) });
  }

  const grid = agenda.createDiv({ cls: "task-hub-agenda-time-grid" });
  const gridLineCount = Math.max(1, (hourCount * 60) / metrics.minorStepMinutes);
  setCssProps(grid, { "--task-hub-agenda-rows": String(gridLineCount) });
  for (let index = 0; index < gridLineCount; index += 1) {
    grid.createDiv({ cls: `task-hub-agenda-hour-line ${metrics.minorStepMinutes < 60 && index % (60 / metrics.minorStepMinutes) !== 0 ? "is-minor" : ""}` });
  }

  const columns = agenda.createDiv({ cls: "task-hub-agenda-columns" });
  for (const day of days) {
    const column = columns.createDiv({ cls: `task-hub-agenda-column ${day === today ? "is-today" : ""}` });
    bindTimedTaskCreation(column, day, startHour, metrics.hourHeight, state, handlers);
    bindCalendarTimedDropTarget(column, day, startHour, metrics.hourHeight, visibleItems, handlers, state);
    const dayTimedItems = timedItems.filter((item) => item.date === day);
    const itemLayouts = layoutTimedItems(dayTimedItems, metrics.hourHeight);
    for (const item of dayTimedItems) {
      renderTimedCalendarItem(column, item, startHour, metrics.hourHeight, handlers, state, itemLayouts.get(item.id));
    }
  }
}

function validCalendarDayStartHour(value: number | undefined): number {
  return Number.isInteger(value) && value !== undefined && value >= 0 && value <= 23 ? value : DEFAULT_START_HOUR;
}

function validCalendarDayEndHour(value: number | undefined, startHour: number): number {
  if (Number.isInteger(value) && value !== undefined && value >= 1 && value <= 24 && value > startHour) return value;
  return DEFAULT_END_HOUR;
}

function agendaTimeMetrics(state: CalendarViewState, hourCount: number, container: HTMLElement): AgendaTimeMetrics {
  const scale = state.calendarTimeScale ?? "hour";
  if (scale !== "fit") {
    return {
      hourHeight: HOUR_HEIGHT_BY_SCALE[scale],
      minorStepMinutes: scale === "quarter" ? 15 : scale === "half" ? 30 : 60
    };
  }
  const containerHeight = measuredElementHeight(container);
  const availableHeight = Number.isFinite(containerHeight) && containerHeight > 0 ? Math.max(120, containerHeight - 190) : hourCount * 36;
  return {
    hourHeight: Math.max(24, Math.min(HOUR_HEIGHT, Math.floor(availableHeight / Math.max(1, hourCount)))),
    minorStepMinutes: 120
  };
}

function measuredElementHeight(element: HTMLElement): number {
  let current: (HTMLElement & { parent?: HTMLElement }) | null | undefined = element;
  while (current) {
    const height = current.getBoundingClientRect().height;
    if (Number.isFinite(height) && height > 0) return height;
    current = current.parentElement ?? current.parent;
  }
  return 0;
}

function bindAgendaTimeScaleWheel(agenda: HTMLElement, state: CalendarViewState, handlers: CalendarViewHandlers): void {
  let pendingWheelSteps = 0;
  agenda.addEventListener("wheel", (event) => {
    if (!event.metaKey || !handlers.onTimeScaleChange) return;
    const currentScale = state.calendarTimeScale ?? "hour";
    const currentIndex = CALENDAR_TIME_SCALES.indexOf(currentScale);
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(CALENDAR_TIME_SCALES.length - 1, currentIndex + direction));
    const nextScale = CALENDAR_TIME_SCALES[nextIndex];
    event.preventDefault();
    if (nextScale === currentScale) {
      pendingWheelSteps = 0;
      return;
    }
    if (Math.sign(pendingWheelSteps) !== direction) pendingWheelSteps = 0;
    pendingWheelSteps += direction;
    if (Math.abs(pendingWheelSteps) < TIME_SCALE_WHEEL_STEP_THRESHOLD) return;
    pendingWheelSteps = 0;
    handlers.onTimeScaleChange(nextScale);
  });
}

function renderAgendaDayHeader(
  container: HTMLElement,
  day: string,
  dayItems: CalendarItem[],
  isToday: boolean,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  const dayDate = new Date(`${day}T00:00:00`);
  const taskCount = dayItems.filter((item) => item.kind === "task").length;
  const eventCount = dayItems.length - taskCount;
  const header = container.createDiv({ cls: `task-hub-agenda-day-header ${isToday ? "is-today" : ""}` });
  bindTaskCreation(header, day, state, handlers);
  bindCalendarDropTarget(header, day, dayItems, handlers, state);
  header.createSpan({ cls: "task-hub-calendar-weekday", text: shortWeekday(dayDate, state.t) });
  header.createSpan({ cls: "task-hub-calendar-day-number", text: String(dayDate.getDate()) });
  if (state.mode === "day" && state.showLunarCalendar) {
    const lunarTitle = formatLunarMonthTitle(dayDate);
    if (lunarTitle) header.createSpan({ cls: "task-hub-calendar-lunar-inline", text: lunarTitle });
  }
  if (dayItems.length > 0) {
    header.createSpan({ cls: "task-hub-calendar-count", text: itemSummary(taskCount, eventCount, state.t) });
  }
}

function layoutTimedItems(items: CalendarItem[], hourHeight: number): Map<string, TimedItemLayout> {
  const layouts = new Map<string, TimedItemLayout>();
  const sortedItems = layoutTimedTaskPoints(items.filter((item) => item.kind === "task"), hourHeight)
    .concat(items.filter((item) => item.kind === "event").map(timedEventLayoutCandidate))
    .sort((left, right) => left.visualStart - right.visualStart || left.visualEnd - right.visualEnd || left.item.title.localeCompare(right.item.title));
  let group: TimedLayoutCandidate[] = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (group.length === 0) return;
    for (const [item, layout] of layoutOverlapGroup(group)) {
      layouts.set(item.id, layout);
    }
    group = [];
    groupEnd = -1;
  };

  for (const candidate of sortedItems) {
    if (group.length > 0 && candidate.visualStart >= groupEnd) {
      flushGroup();
    }
    group.push(candidate);
    groupEnd = Math.max(groupEnd, candidate.visualEnd);
  }
  flushGroup();

  return layouts;
}

function layoutTimedTaskPoints(items: CalendarItem[], hourHeight: number): TimedLayoutCandidate[] {
  const candidates: TimedLayoutCandidate[] = [];
  const sortedItems = [...items].sort(
    (left, right) =>
      (left.startMinutes ?? 0) - (right.startMinutes ?? 0) ||
      taskCompletionRank(left) - taskCompletionRank(right) ||
      (right.createdSortKey ?? "").localeCompare(left.createdSortKey ?? "") ||
      left.title.localeCompare(right.title)
  );

  for (let index = 0; index < sortedItems.length; index += 1) {
    const item = sortedItems[index];
    const startMinutes = item.startMinutes ?? 0;
    const overlapping = sortedItems.filter((candidate) => taskPointsOverlap(item, candidate, hourHeight));
    candidates.push({
      item,
      startMinutes,
      visualStart: startMinutes,
      visualEnd: visualMinutesForPixels(taskPointTopPixels(startMinutes, hourHeight) + TASK_TIME_POINT_HEIGHT, hourHeight),
      overlapIndex: overlapping.findIndex((candidate) => candidate.id === item.id),
      overlapCount: overlapping.length
    });
  }
  return candidates;
}

function taskCompletionRank(item: CalendarItem): number {
  return item.task?.completed ? 1 : 0;
}

function taskPointsOverlap(left: CalendarItem, right: CalendarItem, hourHeight: number): boolean {
  const leftTop = taskPointTopPixels(left.startMinutes ?? 0, hourHeight);
  const rightTop = taskPointTopPixels(right.startMinutes ?? 0, hourHeight);
  return Math.abs(leftTop - rightTop) < TASK_TIME_POINT_HEIGHT + TASK_TIME_POINT_GAP;
}

function timedEventLayoutCandidate(item: CalendarItem): TimedLayoutCandidate {
  const startMinutes = item.startMinutes ?? 0;
  return {
    item,
    startMinutes,
    visualStart: startMinutes,
    visualEnd: itemEndMinutes(item),
    overlapIndex: 0,
    overlapCount: 1
  };
}

function layoutOverlapGroup(items: TimedLayoutCandidate[]): Map<CalendarItem, TimedItemLayout> {
  const layouts = new Map<CalendarItem, TimedItemLayout>();
  const columnEnds: number[] = [];

  for (const candidate of items) {
    if (candidate.item.kind === "task" && candidate.overlapCount > 1 && candidate.overlapIndex > 0) {
      layouts.set(candidate.item, {
        columnIndex: 0,
        columnCount: 1,
        overlapIndex: candidate.overlapIndex,
        overlapCount: candidate.overlapCount,
        overlapItems: overlappingTaskItems(candidate, items),
        isOverlapRepresentative: false
      });
      continue;
    }
    let columnIndex = columnEnds.findIndex((end) => end <= candidate.visualStart);
    if (columnIndex === -1) {
      columnIndex = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[columnIndex] = candidate.visualEnd;
    layouts.set(candidate.item, {
      columnIndex,
      columnCount: 1,
      overlapIndex: candidate.overlapIndex,
      overlapCount: candidate.overlapCount,
      overlapItems: overlappingTaskItems(candidate, items),
      isOverlapRepresentative: candidate.overlapCount <= 1 || candidate.overlapIndex === 0
    });
  }

  const columnCount = Math.max(1, columnEnds.length);
  for (const [item, layout] of layouts) {
    layouts.set(item, { ...layout, columnCount });
  }
  return layouts;
}

function overlappingTaskItems(candidate: TimedLayoutCandidate, items: TimedLayoutCandidate[]): CalendarItem[] | undefined {
  if (candidate.item.kind !== "task" || candidate.overlapCount <= 1) return undefined;
  return items
    .filter((other) => other.item.kind === "task" && timeRangesOverlap(candidate.visualStart, candidate.visualEnd, other.visualStart, other.visualEnd))
    .map((other) => other.item);
}

function timeRangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function itemEndMinutes(item: CalendarItem): number {
  const start = item.startMinutes ?? 0;
  return Math.max(item.endMinutes ?? start + DEFAULT_TIMED_TASK_DURATION_MINUTES, start + MIN_TIMED_ITEM_DURATION_MINUTES);
}

function renderTimedCalendarItem(
  container: HTMLElement,
  item: CalendarItem,
  startHour: number,
  hourHeight: number,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  layout?: TimedItemLayout
): void {
  if (item.kind === "task" && isTaskPointHiddenByOverlap(layout)) return;
  const row = container.createDiv({ cls: calendarItemClass(item, "task-hub-calendar-timed-item") });
  registerCalendarItemElement(row, item);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) setCssProps(row, { "--task-hub-item-color": item.color });
  const startMinutes = item.startMinutes ?? startHour * 60;
  const endMinutes = itemEndMinutes(item);
  const isTaskPoint = item.kind === "task";
  if (isTaskPoint) row.addClass("is-time-point");
  const baseTop = ((startMinutes - startHour * 60) / 60) * hourHeight;
  setCssStyles(row, {
    top: `${baseTop}px`,
    height: isTaskPoint ? `${TASK_TIME_POINT_HEIGHT}px` : `${Math.max(30, ((endMinutes - startMinutes) / 60) * hourHeight - 4)}px`
  });
  if (isTaskPoint && (layout?.overlapCount ?? 1) > 1) {
    row.addClass(layout?.isOverlapRepresentative ? "is-overlap-stack" : "is-overlap-hidden");
    setCssStyles(row, { zIndex: String(10 + (layout?.overlapCount ?? 1)) });
    row.setAttr("data-task-hub-overlap-count", String(layout?.overlapCount ?? 1));
  }
  if (layout && layout.columnCount > 1) {
    setCssStyles(row, {
      left: `calc(${(100 * layout.columnIndex) / layout.columnCount}% + 6px)`,
      right: `calc(${100 - (100 * (layout.columnIndex + 1)) / layout.columnCount}% + 6px)`
    });
  }
  const timeLabel = isTaskPoint || state.calendarTimeScale === "fit" ? undefined : formatTimeRange(startMinutes, endMinutes);
  renderCalendarItemContent(row, item, handlers, state, timeLabel);
  if (isTaskPoint && layout?.isOverlapRepresentative && (layout.overlapCount ?? 1) > 1) {
    row.createSpan({ cls: "task-hub-calendar-overlap-count", text: `+${(layout.overlapCount ?? 1) - 1}` });
  }
  bindCalendarItemDrag(row, item, state, hourHeight);
  bindCalendarItemResize(row, container, item, startHour, hourHeight, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item, event, handlers);
      if (layout?.overlapItems && layout.overlapItems.length > 1) {
        renderTimedTaskOverlapPopover(row, layout.overlapItems, handlers, state);
        return;
      }
      openCalendarDetailsSurface(row, item, handlers, state);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item, event, handlers);
      openCalendarDetailsSurface(row, item, handlers, state);
    });
  }
}

function isTaskPointHiddenByOverlap(layout: TimedItemLayout | undefined): boolean {
  return Boolean(layout && (layout.overlapCount ?? 1) > 1 && !layout.isOverlapRepresentative);
}

function isOverlapStackSummary(layout: TimedItemLayout | undefined): boolean {
  return Boolean(layout && (layout.overlapCount ?? 1) > 1 && layout.isOverlapRepresentative);
}

function bindCalendarItemResize(
  row: HTMLElement,
  column: HTMLElement,
  item: CalendarItem,
  startHour: number,
  hourHeight: number,
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  if (!canResizeCalendarItem(item, state) || item.startMinutes === undefined) return;

  const feedback = row.createDiv({ cls: "task-hub-calendar-resize-feedback" });
  for (const edge of ["start", "end"] as const) {
    let lastTarget: CalendarDropTarget | undefined;
    let previewOriginalStyles: ResizePreviewStyles | undefined;
    const handle = row.createDiv({ cls: `task-hub-calendar-resize-handle is-${edge}` });
    handle.setAttr("aria-hidden", "true");
    handle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const ownerDocument = handle.ownerDocument;
      previewOriginalStyles = captureResizePreviewStyles(row);
      lastTarget = resizeDropTarget(column, event, item, startHour, hourHeight, edge);
      row.removeClass("is-resizing");
      row.addClass("is-resizing");
      updateResizeFeedback(feedback, row, lastTarget ? resizeDeltaMinutes(item, lastTarget, edge) : 0);
      updateResizePreview(row, item, lastTarget, startHour, hourHeight);

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const target = resizeDropTarget(column, moveEvent, item, startHour, hourHeight, edge);
        if (!target) return;
        lastTarget = target;
        updateResizeFeedback(feedback, row, resizeDeltaMinutes(item, target, edge));
        updateResizePreview(row, item, target, startHour, hourHeight);
      };
      const finishResize = () => {
        ownerDocument.removeEventListener("pointermove", onPointerMove);
        ownerDocument.removeEventListener("pointerup", onPointerUp);
        ownerDocument.removeEventListener("pointercancel", onPointerCancel);
        row.removeClass("is-resizing");
        clearResizeFeedback(feedback, row);
        restoreResizePreviewStyles(row, previewOriginalStyles);
        previewOriginalStyles = undefined;
      };
      const onPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        suppressNextTimedCreationClick = true;
        const target = lastTarget ?? resizeDropTarget(column, upEvent, item, startHour, hourHeight, edge);
        lastTarget = undefined;
        finishResize();
        if (!target) return;
        if (item.task) {
          handlers.onTaskReschedule(item.task, target);
          return;
        }
        if (item.event) {
          handlers.onEventReschedule?.(item.event, target);
        }
      };
      const onPointerCancel = () => {
        lastTarget = undefined;
        finishResize();
      };
      ownerDocument.addEventListener("pointermove", onPointerMove);
      ownerDocument.addEventListener("pointerup", onPointerUp);
      ownerDocument.addEventListener("pointercancel", onPointerCancel);
    });
  }
}

function captureResizePreviewStyles(row: HTMLElement): ResizePreviewStyles {
  return {
    top: row.style.top,
    height: row.style.height
  };
}

function updateResizePreview(
  row: HTMLElement,
  item: CalendarItem,
  target: CalendarDropTarget | undefined,
  startHour: number,
  hourHeight: number
): void {
  if (!target || typeof target === "string" || target.startMinutes === undefined || item.startMinutes === undefined) return;
  const top = ((target.startMinutes - startHour * 60) / 60) * hourHeight;
  const height = Math.max(30, (validDurationMinutes(target.durationMinutes) / 60) * hourHeight - 4);
  setCssStyles(row, {
    top: `${top}px`,
    height: `${height}px`
  });
}

function restoreResizePreviewStyles(row: HTMLElement, previewOriginalStyles: ResizePreviewStyles | undefined): void {
  if (!previewOriginalStyles) return;
  setCssStyles(row, {
    top: previewOriginalStyles.top,
    height: previewOriginalStyles.height
  });
}

function updateResizeFeedback(feedback: HTMLElement, row: HTMLElement, deltaMinutes: number): void {
  feedback.textContent = formatMinuteDelta(deltaMinutes);
  row.addClass("has-resize-feedback");
}

function clearResizeFeedback(feedback: HTMLElement, row: HTMLElement): void {
  feedback.textContent = "";
  row.removeClass("has-resize-feedback");
}

function resizeDeltaMinutes(item: CalendarItem, target: CalendarDropTarget, edge: "start" | "end"): number {
  if (typeof target === "string" || item.startMinutes === undefined || target.startMinutes === undefined) return 0;
  const currentEnd = Math.max(item.endMinutes ?? item.startMinutes + DEFAULT_TIMED_TASK_DURATION_MINUTES, item.startMinutes + MIN_TIMED_ITEM_DURATION_MINUTES);
  if (edge === "start") return target.startMinutes - item.startMinutes;
  return target.startMinutes + validDurationMinutes(target.durationMinutes) - currentEnd;
}

function formatMinuteDelta(deltaMinutes: number): string {
  if (deltaMinutes > 0) return `+${deltaMinutes}m`;
  if (deltaMinutes < 0) return `${deltaMinutes}m`;
  return "0m";
}

function resizeDropTarget(
  column: HTMLElement,
  event: { clientY: number },
  item: CalendarItem,
  startHour: number,
  hourHeight: number,
  edge: "start" | "end"
): CalendarDropTarget | undefined {
  if (item.startMinutes === undefined) return undefined;
  const currentStart = item.startMinutes;
  const currentEnd = Math.max(item.endMinutes ?? currentStart + DEFAULT_TIMED_TASK_DURATION_MINUTES, currentStart + MIN_TIMED_ITEM_DURATION_MINUTES);
  const draggedMinutes = minutesFromColumnEvent(column, event, startHour, hourHeight);
  const startMinutes =
    edge === "start"
      ? Math.min(draggedMinutes, currentEnd - MIN_TIMED_ITEM_DURATION_MINUTES)
      : currentStart;
  const endMinutes =
    edge === "end"
      ? Math.max(draggedMinutes, currentStart + MIN_TIMED_ITEM_DURATION_MINUTES)
      : currentEnd;
  return {
    dateKey: item.date,
    startMinutes: clampDayMinutes(startMinutes),
    durationMinutes: Math.max(MIN_TIMED_ITEM_DURATION_MINUTES, clampDayMinutes(endMinutes) - clampDayMinutes(startMinutes))
  };
}

function bindTaskCreation(
  element: HTMLElement,
  target: CalendarDropTarget,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (!state.allowTaskCreation) return;
  element.addEventListener("click", () => handlers.onDateCreateTask(target));
}

function monthCreationTarget(dateKey: string): CalendarDropTarget {
  return dateKey;
}

function bindTimedTaskCreation(
  element: HTMLElement,
  dateKey: string,
  startHour: number,
  hourHeight: number,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (!state.allowTaskCreation) return;
  element.addEventListener("click", (event) => {
    if (suppressNextTimedCreationClick) {
      suppressNextTimedCreationClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    handlers.onDateCreateTask(timedCreationTarget(element, event, dateKey, startHour, hourHeight, state));
  });
}

function timedCreationTarget(
  element: HTMLElement,
  event: MouseEvent,
  dateKey: string,
  startHour: number,
  hourHeight: number,
  state: CalendarViewState
): CalendarDropTarget {
  return {
    dateKey,
    startMinutes: minutesFromColumnEvent(element, event, startHour, hourHeight),
    durationMinutes: validDurationMinutes(state.defaultTimedTaskDurationMinutes)
  };
}

function sourceStatusLabel(source: CalendarSource, t: Translator): string {
  if (source.status.state === "ok") return `${source.status.eventCount} ${t("events")}`;
  if (source.status.state === "error") return errorTypeLabel(source.status.errorType, t);
  return t("notSynced");
}

type CalendarErrorType = Extract<CalendarSourceStatus, { state: "error" }>["errorType"];

function errorTypeLabel(errorType: CalendarErrorType, t: Translator): string {
  if (errorType === "network_error") return t("networkError");
  if (errorType === "http_error") return t("httpError");
  if (errorType === "invalid_content") return t("invalidContent");
  if (errorType === "local_error") return t("localAppleError");
  return t("parseError");
}

function renderLayerToggle(
  container: HTMLElement,
  id: string,
  label: string,
  enabled: boolean,
  handlers: CalendarViewHandlers
): void {
  const row = container.createEl("label", { cls: "task-hub-layer-option" });
  const checkbox = row.createEl("input", { type: "checkbox" });
  checkbox.checked = enabled;
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  checkbox.addEventListener("change", () => handlers.onLayerToggle(id));
  row.createSpan({ text: label });
}

function renderCalendarItem(container: HTMLElement, item: CalendarItem, handlers: CalendarViewHandlers, state: CalendarViewState): void {
  const row = container.createDiv({ cls: calendarItemClass(item) });
  registerCalendarItemElement(row, item);
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) setCssProps(row, { "--task-hub-item-color": item.color });
  renderCalendarItemContent(row, item, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item, event, handlers);
      openCalendarDetailsSurface(row, item, handlers, state);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item, event, handlers);
      openCalendarDetailsSurface(row, item, handlers, state);
    });
  }
}

function renderUnscheduledPanel(container: HTMLElement, state: CalendarViewState, handlers: CalendarViewHandlers): void {
  const panel = container.createEl("aside", { cls: "task-hub-unscheduled-panel" });
  panel.toggleClass("is-opening", Boolean(state.unscheduledPanelOpening && !state.unscheduledPanelClosing));
  panel.toggleClass("is-closing", Boolean(state.unscheduledPanelClosing));
  renderUnscheduledPanelBody(panel, state, handlers);
}

function renderUnscheduledTaskRow(container: HTMLElement, task: TaskItem, state: CalendarViewState, handlers: CalendarViewHandlers): void {
  const item = unscheduledTaskCalendarItem(task, state);
  const row = container.createDiv({ cls: calendarItemClass(item, "task-hub-unscheduled-task") });
  row.toggleClass("is-completing", Boolean(state.completingTaskIds?.has(task.id)));
  registerCalendarItemElement(row, item);
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) setCssProps(row, { "--task-hub-item-color": item.color });

  const checkbox = row.createEl("input", { type: "checkbox" });
  checkbox.checked = task.completed;
  checkbox.disabled = !canToggleCalendarTask(task, state);
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    row.addClass("is-completing");
    handlers.onTaskComplete(task);
  });

  const body = row.createDiv({ cls: "task-hub-unscheduled-task-body" });
  body.createSpan({ cls: "task-hub-unscheduled-task-title", text: task.text });
  const meta = [task.source === "vault" ? task.filePath : task.source, task.tags.join(" ")].filter(Boolean).join(" · ");
  if (meta) body.createSpan({ cls: "task-hub-unscheduled-task-meta", text: meta });

  row.addEventListener("click", (event) => {
    event.stopPropagation();
    selectCalendarItem(row, item, event, handlers);
    if (state.mode === "day") {
      activeDetailsSelectionKey = calendarItemSelectionKey(item);
      refreshActiveDaySidebar();
    }
  });
}

function primeDaySidebarSelection(dayItems: CalendarItem[]): void {
  if (dayItems.length === 0) {
    activeDetailsSelectionKey = undefined;
    activeSelectedCalendarItemKey = undefined;
    return;
  }

  const validKeys = new Set(dayItems.map((item) => calendarItemSelectionKey(item)));
  const preferredKey =
    (activeSelectedCalendarItemKey && validKeys.has(activeSelectedCalendarItemKey) ? activeSelectedCalendarItemKey : undefined) ??
    (activeDetailsSelectionKey && validKeys.has(activeDetailsSelectionKey) ? activeDetailsSelectionKey : undefined) ??
    [...activeSelectedCalendarItemKeys].find((key) => validKeys.has(key)) ??
    calendarItemSelectionKey(dayItems[0]);
  const selectedItem = dayItems.find((item) => calendarItemSelectionKey(item) === preferredKey) ?? dayItems[0];
  const selectedKey = calendarItemSelectionKey(selectedItem);
  activeSelectedCalendarItemKey = selectedKey;
  activeDetailsSelectionKey = selectedKey;
  if (activeSelectedCalendarItemKeys.size === 0) {
    activeSelectedCalendarItemKeys = new Set([selectedKey]);
  }
  if (activeSelectedTaskIds.size === 0 && selectedItem.task) {
    activeSelectedTaskIds = new Set([selectedItem.task.id]);
  }
}

function refreshActiveDaySidebar(): void {
  if (!activeDaySidebarHost || !activeDaySidebarContext) return;
  renderCalendarDaySidebar(
    activeDaySidebarHost,
    activeDaySidebarContext.day,
    activeDaySidebarContext.dayItems,
    activeDaySidebarContext.miniMonthStats,
    activeDaySidebarContext.state,
    activeDaySidebarContext.handlers
  );
}

function renderCalendarDaySidebar(
  container: HTMLElement,
  day: string,
  dayItems: CalendarItem[],
  miniMonthStats: Map<string, MiniMonthDayStats>,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  container.empty();
  const dayDate = new Date(`${day}T12:00:00`);
  renderCalendarMiniMonth(container, dayDate, miniMonthStats, state, handlers);

  if (dayItems.length === 0) {
    container.createDiv({ cls: "task-hub-calendar-day-sidebar-empty", text: state.t("calendarEmpty") });
  } else {
    const selectedItem =
      dayItems.find((item) => calendarItemSelectionKey(item) === activeDetailsSelectionKey)
      ?? dayItems.find((item) => calendarItemSelectionKey(item) === activeSelectedCalendarItemKey)
      ?? dayItems[0];
    activeDetailsSelectionKey = calendarItemSelectionKey(selectedItem);
    if (selectedItem.task) {
      const detailSurface = container.createDiv({ cls: "task-hub-calendar-day-detail task-hub-calendar-day-task-detail" });
      renderTaskDetails(
        detailSurface,
        selectedItem.task,
        undefined,
        calendarTaskRowHandlers(handlers),
        calendarTaskRenderOptions(state),
        state.t
      );
    } else if (selectedItem.event) {
      const detailSurface = container.createDiv({
        cls: "task-hub-calendar-day-detail task-hub-calendar-detail-surface task-hub-calendar-day-event-detail"
      });
      if (selectedItem.color) setCssProps(detailSurface, { "--task-hub-item-color": selectedItem.color });
      renderCalendarDetailHeader(detailSurface, selectedItem, handlers, state, { dismissible: false });
      renderEventDetailsPopover(detailSurface, selectedItem, selectedItem.event, handlers, state, () => undefined);
    }
  }

  if (state.unscheduledPanelOpen || state.unscheduledPanelClosing) {
    const unscheduledSurface = container.createDiv({
      cls: "task-hub-calendar-day-sidebar-section task-hub-calendar-day-unscheduled"
    });
    unscheduledSurface.toggleClass(
      "is-opening",
      Boolean(state.unscheduledPanelOpening && !state.unscheduledPanelClosing)
    );
    unscheduledSurface.toggleClass("is-closing", Boolean(state.unscheduledPanelClosing));
    renderUnscheduledPanelBody(unscheduledSurface, state, handlers);
  }
}

function renderCalendarMiniMonth(
  container: HTMLElement,
  focusDate: Date,
  miniMonthStats: Map<string, MiniMonthDayStats>,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  const monthSection = container.createDiv({ cls: "task-hub-calendar-day-sidebar-section task-hub-calendar-mini-month" });
  monthSection.createDiv({ cls: "task-hub-calendar-mini-month-title", text: miniMonthTitle(focusDate, state.t) });
  const weekdayRow = monthSection.createDiv({ cls: "task-hub-calendar-mini-month-weekdays" });
  const weekdayLabels = miniMonthWeekdays(state.weekStart, state.t);
  for (const weekday of weekdayLabels) {
    weekdayRow.createSpan({ text: weekday });
  }

  const grid = monthSection.createDiv({ cls: "task-hub-calendar-mini-month-grid" });
  for (const cell of miniMonthCells(focusDate, state.weekStart)) {
    const button = grid.createEl("button", { cls: "task-hub-calendar-mini-month-day", text: String(cell.date.getDate()) });
    const dateKey = toLocalDateKey(cell.date);
    const stats = miniMonthStats.get(dateKey);
    const completionClass = miniMonthCompletionClass(stats?.completedTaskCount ?? 0);
    const tooltip = miniMonthTooltip(cell.date, stats, state.t);
    if ((stats?.taskCount ?? 0) > 0) button.addClass("has-task");
    if (!cell.isCurrentMonth) button.addClass("is-outside-month");
    if (cell.isToday) button.addClass("is-today");
    if (cell.isFocusedDay) button.addClass("is-selected");
    if (completionClass) button.addClass(completionClass);
    button.setAttr("aria-label", tooltip.replace(/\n/g, ", "));
    setTooltip(button, tooltip, { placement: "top" });
    button.addEventListener("click", () => handlers.onFocusDateChange?.(cell.date));
  }
}

function renderUnscheduledPanelBody(container: HTMLElement, state: CalendarViewState, handlers: CalendarViewHandlers): void {
  const tasks = state.unscheduledTasks ?? [];
  const header = container.createDiv({ cls: "task-hub-unscheduled-header" });
  header.createDiv({ cls: "task-hub-unscheduled-title", text: state.t("unscheduled") });
  header.createDiv({ cls: "task-hub-unscheduled-count", text: String(tasks.length) });

  if (tasks.length === 0) {
    container.createDiv({ cls: "task-hub-unscheduled-empty", text: state.t("noUnscheduledTasks") });
    return;
  }

  const list = container.createDiv({ cls: "task-hub-unscheduled-list" });
  for (const task of tasks) {
    renderUnscheduledTaskRow(list, task, state, handlers);
  }
}

function miniMonthWeekdays(weekStart: WeekStart, t: Translator): string[] {
  const startIndex = WEEK_START_DAY_INDEX[weekStart];
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(2026, 4, 3 + ((startIndex + offset) % 7));
    return shortWeekday(date, t);
  });
}

function miniMonthTitle(date: Date, t: Translator): string {
  return date.toLocaleDateString(t.locale ?? "en-US", { month: "long" });
}

function buildMiniMonthStats(
  items: CalendarItem[],
  tasks: TaskItem[],
  visibleSourceIds: ReadonlySet<string>
): Map<string, MiniMonthDayStats> {
  const stats = new Map<string, MiniMonthDayStats>();
  for (const item of items) {
    const dayStats = stats.get(item.date) ?? { taskCount: 0, completedTaskCount: 0, eventCount: 0 };
    if (item.kind === "task") {
      dayStats.taskCount += 1;
    } else {
      dayStats.eventCount += 1;
    }
    stats.set(item.date, dayStats);
  }

  for (const task of tasks) {
    if (!visibleSourceIds.has(task.source)) continue;
    if (!task.completed || !task.completedDate) continue;
    const completedDateKey = task.completedDate.slice(0, 10);
    const dayStats = stats.get(completedDateKey) ?? { taskCount: 0, completedTaskCount: 0, eventCount: 0 };
    dayStats.completedTaskCount += 1;
    stats.set(completedDateKey, dayStats);
  }

  return stats;
}

function miniMonthCompletionClass(completedTaskCount: number): string | undefined {
  if (completedTaskCount <= 0) return undefined;
  return `is-completion-${Math.min(4, completedTaskCount)}`;
}

function miniMonthTooltip(date: Date, stats: MiniMonthDayStats | undefined, t: Translator): string {
  const taskCount = stats?.taskCount ?? 0;
  const completedTaskCount = stats?.completedTaskCount ?? 0;
  const eventCount = stats?.eventCount ?? 0;
  const taskLabel = t(taskCount === 1 ? "task" : "tasks");
  const eventLabel = t(eventCount === 1 ? "event" : "events");
  return [
    date.toLocaleDateString(t.locale ?? "en-US", { month: "short", day: "numeric", weekday: "short" }),
    `${taskCount} ${taskLabel}`,
    `${completedTaskCount} ${t("completed")}`,
    `${eventCount} ${eventLabel}`
  ].join("\n");
}

function calendarTaskRowHandlers(handlers: CalendarViewHandlers): TaskRowHandlers {
  return {
    onComplete: handlers.onTaskComplete,
    onJump: handlers.onTaskJump,
    onTaskReschedule: (task, target) => handlers.onTaskReschedule(task, target),
    onSendToAppleReminders: (task) => handlers.onTaskSendToAppleReminders?.(task),
    onSendToDida: handlers.onTaskSendToDida,
    onSendToTarget: handlers.onTaskSendToTarget,
    onSendToAppleCalendar: handlers.onTaskSendToAppleCalendar,
    onSelect: (task) => handlers.onTaskSelect(task),
    onTagSelect: () => undefined,
    onSourceSelect: () => undefined,
    onAppleReminderListChange: (task, listId) => handlers.onAppleReminderListChange?.(task, listId),
    onDidaProjectChange: () => undefined,
    onTaskUpdate: handlers.onTaskUpdate,
    onTaskDelete: handlers.onTaskDelete,
    onCreateTaskNote: handlers.onCreateTaskNote,
    onOpenTaskNote: handlers.onOpenTaskNote ?? (() => undefined),
    onDeleteTaskNote: handlers.onDeleteTaskNote ?? (() => undefined),
    onOpenTaskNoteSource: handlers.onOpenTaskNoteSource,
    onOpenTaskNoteInThino: handlers.onOpenTaskNoteInThino,
    onTaskNoteReorder: handlers.onTaskNoteReorder,
    onToggleTaskNotePinned: handlers.onToggleTaskNotePinned
  };
}

function calendarTaskRenderOptions(state: CalendarViewState): TaskRenderOptions {
  return {
    allowAppleReminderWriteback: state.allowAppleReminderWriteback,
    allowAppleReminderCreate: state.allowAppleReminderCreate,
    allowDidaWriteback: state.allowDidaWriteback,
    allowDidaDragReschedule: state.allowDidaDragReschedule,
    allowDidaDelete: state.allowDidaDelete,
    allowDidaCreate: state.allowDidaCreate,
    allowAppleCalendarReminderConversion: state.allowAppleCalendarReminderConversion,
    sourceColors: {
      vault: state.sources.find((source) => source.id === "vault")?.color,
      "apple-reminders": state.sources.find((source) => source.id === "apple-reminders")?.color,
      dida: state.sources.find((source) => source.id === "dida")?.color
    },
    taskColors: state.taskColors,
    appleReminderLists: state.appleReminderLists,
    didaProjects: state.didaProjects,
    taskSendDefaultTarget: state.taskSendDefaultTarget,
    bindTagInputSuggest: state.bindTagInputSuggest,
    taskNotesEnabled: state.taskNotesEnabled,
    allowThinoNoteEdit: state.allowThinoNoteEdit,
    getTaskNotes: state.getTaskNotes,
    renderNoteMarkdown: state.renderNoteMarkdown
  };
}

function miniMonthCells(focusDate: Date, weekStart: WeekStart): Array<{ date: Date; isCurrentMonth: boolean; isFocusedDay: boolean; isToday: boolean }> {
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const leading = monthLeadingPlaceholderCount(toLocalDateKey(monthStart), weekStart);
  const monthEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
  const dayCount = monthEnd.getDate();
  const visibleCellCount = Math.ceil((leading + dayCount) / 7) * 7;
  const firstCell = new Date(monthStart);
  firstCell.setDate(monthStart.getDate() - leading);
  const todayKey = toLocalDateKey(new Date());
  const focusedKey = toLocalDateKey(focusDate);
  return Array.from({ length: visibleCellCount }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    const key = toLocalDateKey(date);
    return {
      date,
      isCurrentMonth: date.getMonth() === focusDate.getMonth(),
      isFocusedDay: key === focusedKey,
      isToday: key === todayKey
    };
  });
}

function bindHiddenItemCount(container: HTMLElement): void {
  const badge = container.createDiv({ cls: "task-hub-hidden-count" });
  badge.setAttr("aria-hidden", "true");
  const update = () => updateHiddenItemCount(container, badge);
  container.addEventListener("scroll", update);
  update();
  container.win.requestAnimationFrame?.(update);
}

function updateHiddenItemCount(container: HTMLElement, badge: HTMLElement): void {
  const containerRect = container.getBoundingClientRect();
  const visibleBottom = containerRect.bottom || containerRect.top + container.clientHeight;
  const items = Array.from(container.children).filter((child): child is HTMLElement =>
    "classList" in child && child.classList.contains("task-hub-calendar-item")
  );
  if (visibleBottom <= containerRect.top || items.every((item) => item.getBoundingClientRect().height === 0)) {
    badge.textContent = "";
    container.removeClass("has-hidden-items");
    return;
  }
  const hiddenCount = items.filter((item) => item.getBoundingClientRect().top >= visibleBottom).length;
  if (hiddenCount > 0) {
    badge.textContent = `+${hiddenCount}`;
    container.addClass("has-hidden-items");
    return;
  }
  badge.textContent = "";
  container.removeClass("has-hidden-items");
}

function openCalendarDetailsSurface(anchor: HTMLElement, item: CalendarItem, handlers: CalendarViewHandlers, state: CalendarViewState): void {
  activeDetailsSelectionKey = calendarItemSelectionKey(item);
  if (state.mode === "day") {
    refreshActiveDaySidebar();
    return;
  }
  renderCalendarDetailsPopover(anchor, item, handlers, state);
}

function registerCalendarItemElement(element: HTMLElement, item: CalendarItem): void {
  (element as HTMLElement & { taskHubCalendarItem?: CalendarItem }).taskHubCalendarItem = item;
  const key = calendarItemSelectionKey(item);
  element.setAttr("data-task-hub-calendar-selection", key);
  const elements = activeCalendarItemElements.get(key) ?? new Set<HTMLElement>();
  elements.add(element);
  activeCalendarItemElements.set(key, elements);
  if (key === activeSelectedCalendarItemKey) {
    element.addClass("is-selected");
  }
  if (activeSelectedCalendarItemKeys.has(key)) {
    element.addClass("is-multi-selected");
  }
}

function selectCalendarItem(element: HTMLElement, item: CalendarItem, event?: MouseEvent, handlers?: CalendarViewHandlers): void {
  const key = calendarItemSelectionKey(item);
  activeSelectedCalendarItemKey = key;
  if (event?.metaKey || event?.ctrlKey) {
    if (activeSelectedCalendarItemKeys.has(key)) {
      activeSelectedCalendarItemKeys.delete(key);
    } else {
      activeSelectedCalendarItemKeys.add(key);
    }
    if (activeSelectedCalendarItemKeys.size === 0) activeSelectedCalendarItemKeys.add(key);
  } else {
    activeSelectedCalendarItemKeys = new Set([key]);
  }
  activeSelectedTaskIds = taskIdsFromCalendarSelection();
  if (item.task) handlers?.onTaskSelectionChange?.(item.task, [...activeSelectedTaskIds]);
  syncCalendarSelectionClasses(element);
}

function taskIdsFromCalendarSelection(): Set<string> {
  const taskIds = new Set<string>();
  for (const key of activeSelectedCalendarItemKeys) {
    if (key.startsWith("task:")) taskIds.add(key.slice("task:".length));
  }
  return taskIds;
}

function syncCalendarSelectionClasses(element: HTMLElement): void {
  for (const elements of activeCalendarItemElements.values()) {
    for (const candidate of elements) {
      candidate.removeClass("is-selected");
      candidate.removeClass("is-multi-selected");
    }
  }
  if (activeSelectedCalendarItemKey) {
    for (const selected of activeCalendarItemElements.get(activeSelectedCalendarItemKey) ?? [element]) {
      selected.addClass("is-selected");
    }
  }
  for (const taskId of activeSelectedTaskIds) {
    for (const selected of activeCalendarItemElements.get(`task:${taskId}`) ?? []) {
      selected.addClass("is-multi-selected");
    }
  }
  for (const key of activeSelectedCalendarItemKeys) {
    for (const selected of activeCalendarItemElements.get(key) ?? []) {
      selected.addClass("is-multi-selected");
    }
  }
}

function calendarItemSelectionKey(item: CalendarItem): string {
  if (item.task) return `task:${item.task.id}`;
  if (item.event) return `event:${calendarEventLayerId(item.event)}:${item.event.id}`;
  return item.id;
}

function renderCalendarDetailsPopover(anchor: HTMLElement, item: CalendarItem, handlers: CalendarViewHandlers, state: CalendarViewState): void {
  clearActiveCalendarDetails();
  const ownerDocument = anchor.ownerDocument;
  const popover = ownerDocument.createElement("div");
  popover.addClass("task-hub-calendar-detail-popover");
  popover.addEventListener("click", (event) => event.stopPropagation());
  ownerDocument.body.appendChild(popover);
  activeDetailsElement = popover;
  activeDetailsSelectionKey = calendarItemSelectionKey(item);
  if (item.color) setCssProps(popover, { "--task-hub-item-color": item.color });
  positionDetailsPopover(popover, anchor);

  const closePopover = () => clearActiveCalendarDetails();
  const cleanupPopover = () => {
    ownerDocument.removeEventListener("click", closePopover);
    ownerDocument.removeEventListener("keydown", closeOnEscape);
    popover.remove();
  };
  activeDetailsCleanup = cleanupPopover;
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") closePopover();
  };
  ownerDocument.addEventListener("click", closePopover);
  ownerDocument.addEventListener("keydown", closeOnEscape);

  const header = renderCalendarDetailHeader(popover, item, handlers, state, { dismissible: true, onClose: closePopover });
  bindDetailsPopoverDrag(popover, header, ownerDocument);

  if (item.task) {
    renderTaskDetailsPopover(popover, item, item.task, handlers, state, closePopover);
    return;
  }
  if (item.event) {
    renderEventDetailsPopover(popover, item, item.event, handlers, state, closePopover);
  }
}

function renderCalendarDetailHeader(
  container: HTMLElement,
  item: CalendarItem,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  options: { dismissible: boolean; onClose?: () => void }
): HTMLElement {
  const header = container.createDiv({ cls: "task-hub-calendar-detail-header" });
  if (!options.dismissible) header.addClass("is-static");
  const title = header.createDiv({ cls: "task-hub-calendar-detail-title" });
  title.addClass(item.task ? "is-task" : "is-event");
  if (item.task) {
    title.addClass("has-complete-checkbox");
    const checkboxCell = title.createSpan({ cls: "task-hub-calendar-detail-title-check-cell" });
    renderCalendarTaskCompleteCheckbox(checkboxCell, item.task, canToggleCalendarTask(item.task, state), handlers, state);
  }
  title.createSpan({ cls: "task-hub-calendar-detail-title-text", text: state.t(item.task ? "taskDetails" : "calendarDetails") });
  renderDetailSourceLogo(title, item);
  if (options.dismissible) {
    const close = header.createEl("button", { cls: "task-hub-icon-button", text: "×" });
    close.setAttr("aria-label", state.t("cancel"));
    close.addEventListener("click", () => options.onClose?.());
  }
  return header;
}

function clearActiveCalendarDetails(preserveSelection = false): void {
  const cleanup = activeDetailsCleanup;
  const element = activeDetailsElement;
  activeDetailsCleanup = undefined;
  activeDetailsElement = undefined;
  if (!preserveSelection) activeDetailsSelectionKey = undefined;
  if (cleanup) {
    cleanup();
  } else {
    element?.remove();
  }
}

function restoreCalendarDetailsPopover(selectionKey: string | undefined, handlers: CalendarViewHandlers, state: CalendarViewState): void {
  if (!selectionKey) return;
  const anchor = activeCalendarItemElements.get(selectionKey)?.values().next().value;
  const item = anchor ? (anchor as HTMLElement & { taskHubCalendarItem?: CalendarItem }).taskHubCalendarItem : undefined;
  if (!anchor || !item) {
    activeDetailsSelectionKey = undefined;
    return;
  }
  renderCalendarDetailsPopover(anchor, item, handlers, state);
}

function renderTimedTaskOverlapPopover(anchor: HTMLElement, items: CalendarItem[], handlers: CalendarViewHandlers, state: CalendarViewState): void {
  clearActiveCalendarDetails();
  const ownerDocument = anchor.ownerDocument;
  const popover = ownerDocument.createElement("div");
  popover.addClass("task-hub-calendar-overlap-popover");
  popover.addEventListener("click", (event) => event.stopPropagation());
  ownerDocument.body.appendChild(popover);
  activeDetailsElement = popover;
  positionDetailsPopover(popover, anchor);

  const closePopover = () => {
    ownerDocument.removeEventListener("click", closePopover);
    popover.remove();
    if (activeDetailsElement === popover) activeDetailsElement = undefined;
  };
  ownerDocument.addEventListener("click", closePopover);

  for (const item of items) {
    const row = popover.createDiv({ cls: calendarItemClass(item, "task-hub-calendar-overlap-row") });
    if (item.color) setCssProps(row, { "--task-hub-item-color": item.color });
    const task = item.task;
    const checkbox = row.createEl("input", { cls: "task-hub-calendar-overlap-check", type: "checkbox" });
    checkbox.checked = Boolean(task?.completed);
    checkbox.disabled = !task || !canToggleCalendarTask(task, state);
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      if (task) handlers.onTaskComplete(task);
    });
    const body = row.createDiv({ cls: "task-hub-calendar-overlap-body" });
    body.createSpan({ cls: "task-hub-calendar-overlap-title", text: item.title });
    if (item.startMinutes !== undefined) body.createSpan({ cls: "task-hub-calendar-overlap-time", text: formatMinutes(item.startMinutes) });
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      closePopover();
      selectCalendarItem(anchor, item, event, handlers);
      openCalendarDetailsSurface(anchor, item, handlers, state);
    });
  }
}

function renderDetailSourceLogo(container: HTMLElement, item: CalendarItem): void {
  const source = sourceLogoKindForCalendarItem(item);
  if (!source) return;
  renderSourceLogo(container, "task-hub-calendar-detail-logo", source);
}

function positionDetailsPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const width = 320;
  const viewportWidth = anchor.win.innerWidth || 1024;
  const viewportHeight = anchor.win.innerHeight || 768;
  const left = Math.max(8, Math.min(rect.right + 8, viewportWidth - width - 8));
  const top = Math.max(8, Math.min(rect.top, viewportHeight - 420));
  setCssStyles(popover, { left: `${left}px`, top: `${top}px` });
}

function bindDetailsPopoverDrag(popover: HTMLElement, handle: HTMLElement, ownerDocument: Document): void {
  handle.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, a")) return;
    event.preventDefault();
    event.stopPropagation();

    const startLeft = Number.parseFloat(popover.getCssPropertyValue("left") || "0");
    const startTop = Number.parseFloat(popover.getCssPropertyValue("top") || "0");
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    popover.addClass("is-dragging");

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const maxLeft = Math.max(8, (popover.win.innerWidth || 1024) - popover.getBoundingClientRect().width - 8);
      const maxTop = Math.max(8, (popover.win.innerHeight || 768) - popover.getBoundingClientRect().height - 8);
      const left = Math.max(8, Math.min(startLeft + moveEvent.clientX - startX, maxLeft));
      const top = Math.max(8, Math.min(startTop + moveEvent.clientY - startY, maxTop));
      setCssStyles(popover, { left: `${left}px`, top: `${top}px` });
    };

    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      popover.removeClass("is-dragging");
      ownerDocument.removeEventListener("pointermove", move);
      ownerDocument.removeEventListener("pointerup", end);
      ownerDocument.removeEventListener("pointercancel", end);
    };

    ownerDocument.addEventListener("pointermove", move);
    ownerDocument.addEventListener("pointerup", end);
    ownerDocument.addEventListener("pointercancel", end);
  });
}

function renderTaskDetailsPopover(
  popover: HTMLElement,
  item: CalendarItem,
  task: TaskItem,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  closePopover: () => void
): void {
  const editable = task.source === "vault" || (task.source === "apple-reminders" && state.allowAppleReminderWriteback) || (task.source === "dida" && state.allowDidaWriteback);
  const canEdit = (task.source === "apple-reminders" || task.source === "dida") && editable && Boolean(handlers.onTaskUpdate);
  const form = popover.createDiv({ cls: "task-hub-calendar-detail-form" });
  const title = detailAutoGrowTextarea(form, state.t("taskCreationBody"), task.text, "task-hub-calendar-detail-title-input");
  state.bindTagInputSuggest?.(title);
  const date = detailInput(form, state.t("date"), taskPlannedDateKey(task) ?? "", "date");
  const time = detailInput(form, state.t("startTime"), timeFromTask(task), "time");
  const alertEditor = task.source === "apple-reminders" ? reminderAlertEditor(form, time, task.alertMinutesBefore, state.t) : undefined;
  let tags: HTMLInputElement | undefined;
  if (task.source === "vault") {
    tags = detailInput(form, state.t("tags"), task.tags.join(" ")) as HTMLInputElement;
    state.bindTagInputSuggest?.(tags);
  }
  const detailExtra = renderCalendarDetailExtraToggle(form, state);
  const recurrence = canEdit
    ? createRecurrenceSelect(detailExtra.extra, state.t("recurrence"), task.recurrence, state.t)
    : undefined;
  if (!canEdit) {
    renderReadonlyDetailRow(detailExtra.extra, state.t("recurrence"), recurrenceLabel(task.recurrence, state.t));
  }
  let notes: HTMLTextAreaElement | undefined;
  if (task.source === "apple-reminders" || task.source === "dida") {
    notes = canEdit
      ? detailTextarea(detailExtra.extra, state.t("notes"), task.contextPreview ?? "")
      : undefined;
    if (!canEdit) {
      renderReadonlyDetailRow(detailExtra.extra, state.t("notes"), task.contextPreview ?? "");
    }
  }
  for (const field of [title, date, time, tags, alertEditor?.select]) {
    if (field) field.disabled = !canEdit;
  }
  if (canEdit) {
    let dirty = false;
    let lastCommittedSignature = "";
    const buildDraft = (): Extract<CalendarItemEditDraft, { kind: "task" }> => {
      const detailsEnabled = detailExtra.toggle.checked;
      return {
        kind: "task",
        title: title.value,
        date: date.value,
        startTime: time.value || undefined,
        tags: tags ? tags.value.split(/\s+/).filter(Boolean) : undefined,
        alertMinutesBefore: alertEditor?.getAlertMinutesBefore() ?? null,
        ...(detailsEnabled && notes ? { notes: notes.value } : {}),
        ...(detailsEnabled && recurrence ? { recurrence: recurrenceValueFromSelect(recurrence) ?? null } : {})
      };
    };
    const markDirty = () => {
      dirty = true;
      popover.addClass("is-auto-save-dirty");
    };
    const commit = () => {
      const draft = buildDraft();
      const signature = JSON.stringify(draft);
      if (!dirty || signature === lastCommittedSignature) {
        dirty = false;
        popover.removeClass("is-auto-save-dirty");
        return;
      }
      dirty = false;
      lastCommittedSignature = signature;
      popover.removeClass("is-auto-save-dirty");
      handlers.onTaskUpdate?.(task, draft);
    };
    lastCommittedSignature = JSON.stringify(buildDraft());
    const editableFields = [title, date, time, tags, recurrence, notes, detailExtra.toggle, alertEditor?.select].filter(isHTMLElement);
    for (const field of editableFields) {
      if (!field) continue;
      field.addEventListener("input", markDirty);
      field.addEventListener("change", markDirty);
      bindDetailCommitKeys(field, commit);
    }
  }
  const sendTargetOptions = task.source === "vault" ? taskSendOptionsForCalendar(state) : [];
  if (sendTargetOptions.length > 0) {
    const actions = popover.createDiv({ cls: "task-hub-calendar-detail-actions" });
    if (sendTargetOptions.length > 0) {
      renderCalendarTaskSendControl(actions, task, sendTargetOptions, handlers, state, closePopover);
    }
  }
  if (!editable) {
    popover.createDiv({ cls: "task-hub-detail-note", text: state.t("externalTaskReadOnly") });
  }
  renderCalendarNotes(popover, state.getTaskNotes?.(task) ?? [], handlers, state);
}

function renderCalendarTaskCompleteCheckbox(
  container: HTMLElement,
  task: TaskItem,
  canToggle: boolean,
  handlers: Pick<CalendarViewHandlers, "onTaskComplete">,
  state: CalendarViewState
): HTMLInputElement {
  const checkbox = container.createEl("input", { cls: "task-hub-detail-complete-checkbox", type: "checkbox" }) as HTMLInputElement;
  checkbox.checked = task.completed;
  checkbox.disabled = !canToggle;
  checkbox.setAttr("aria-label", task.completed ? state.t("markOpen") : state.t("markComplete"));
  checkbox.addEventListener("change", () => handlers.onTaskComplete(task));
  return checkbox;
}

function renderCalendarTaskSendControl(
  actions: HTMLElement,
  task: TaskItem,
  options: ReturnType<typeof taskSendOptionsForCalendar>,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  closePopover: () => void
): void {
  const control = actions.createDiv({ cls: "task-hub-send-control" });
  const selected = preferredTaskSendTarget(options, state.taskSendDefaultTarget) ?? options[0];
  const send = control.createEl("button", { cls: "mod-cta", text: state.t("sendTo") });
  const picker = renderCalendarTaskSendTargetPicker(control, options, selected.value, state);
  send.addEventListener("click", () => {
    const target = parseTaskSendTarget(picker.getValue());
    if (handlers.onTaskSendToTarget) {
      handlers.onTaskSendToTarget(task, target);
    } else if (target.type === "dida") {
      handlers.onTaskSendToDida?.(task);
    } else {
      handlers.onTaskSendToAppleReminders?.(task);
    }
    closePopover();
  });
}

function renderCalendarTaskSendTargetPicker(
  container: HTMLElement,
  options: ReturnType<typeof taskSendOptionsForCalendar>,
  selectedValue: string,
  state: CalendarViewState
): { getValue: () => string } {
  let currentValue = selectedValue;
  const current = options.find((option) => option.value === currentValue) ?? options[0];
  currentValue = current.value;
  const select = container.createEl("select", { cls: "task-hub-send-target-select" }) as HTMLSelectElement;
  select.setAttr("aria-label", state.t("sendToTarget"));
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

function taskSendOptionsForCalendar(state: CalendarViewState) {
  return taskSendTargetOptions({
    allowAppleReminderCreate: state.allowAppleReminderCreate,
    allowDidaCreate: state.allowDidaCreate,
    appleReminderLists: state.appleReminderLists,
    didaProjects: state.didaProjects
  }, {
    appleReminders: state.t("localAppleReminders"),
    appleRemindersInbox: state.t("localAppleRemindersDefaultListInbox"),
    dida: state.t("dida"),
    didaInbox: state.t("didaDefaultProjectInbox")
  });
}

function renderEventDetailsPopover(
  popover: HTMLElement,
  item: CalendarItem,
  event: CalendarEvent,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  closePopover: () => void
): void {
  const editable = event.sourceId === "apple-calendar" && Boolean(state.allowAppleCalendarWriteback) && isWritableAppleCalendarEvent(item, state);
  const canEdit = editable && Boolean(handlers.onEventUpdate);
  const form = popover.createDiv({ cls: "task-hub-calendar-detail-form" });
  const title = detailInput(form, state.t("eventCreationPlaceholder"), event.title);
  const date = detailInput(form, state.t("date"), dateFromDateTime(event.start), "date");
  const allDayCheckbox = detailCheckbox(form, state.t("allDay"));
  allDayCheckbox.checked = event.allDay;
  const startField = detailInputField(form, state.t("startTime"), event.allDay ? "" : timeFromDateTime(event.start), "time");
  const endField = detailInputField(form, state.t("endTime"), event.allDay ? "" : timeFromDateTime(event.end), "time");
  const start = startField.input;
  const end = endField.input;
  const updateTimedFieldVisibility = () => {
    startField.field.toggleClass("is-hidden", allDayCheckbox.checked);
    endField.field.toggleClass("is-hidden", allDayCheckbox.checked);
  };
  allDayCheckbox.addEventListener("change", updateTimedFieldVisibility);
  updateTimedFieldVisibility();
  const calendar = detailSelect(form, state.t("localAppleCalendar"), state.appleCalendars ?? [], event.calendarId);
  const detailExtra = renderCalendarDetailExtraToggle(form, state);
  const recurrence = canEdit
    ? createRecurrenceSelect(detailExtra.extra, state.t("recurrence"), event.recurrence, state.t)
    : undefined;
  const recurrenceScope = canEdit ? renderRecurrenceScopeSelect(detailExtra.extra, state) : undefined;
  const location = canEdit ? detailInput(detailExtra.extra, state.t("location"), event.location ?? "") : undefined;
  const notes = canEdit ? detailTextarea(detailExtra.extra, state.t("notes"), event.description ?? "") : undefined;
  if (!canEdit) {
    renderReadonlyDetailRow(detailExtra.extra, state.t("recurrence"), recurrenceLabel(event.recurrence, state.t));
    renderReadonlyDetailRow(detailExtra.extra, state.t("location"), event.location ?? "");
    renderReadonlyDetailRow(detailExtra.extra, state.t("notes"), event.description ?? "");
  }
  if (event.url) form.createDiv({ cls: "task-hub-calendar-detail-readonly-row is-muted", text: event.url });
  for (const field of [title, date, start, end, calendar, allDayCheckbox]) {
    field.disabled = !canEdit;
  }
  if (canEdit) {
    let dirty = false;
    let lastCommittedSignature = "";
    const buildDraft = (): Extract<CalendarItemEditDraft, { kind: "event" }> => {
      const detailsEnabled = detailExtra.toggle.checked;
      return {
        kind: "event",
        title: title.value,
        date: date.value,
        startTime: start.value || undefined,
        endTime: end.value || undefined,
        allDay: allDayCheckbox.checked,
        calendarId: calendar.value,
        ...(detailsEnabled && notes ? { notes: notes.value } : {}),
        ...(detailsEnabled && location ? { location: location.value } : {}),
        ...(detailsEnabled && recurrence
          ? {
              recurrence: recurrenceValueFromSelect(recurrence) ?? null,
              recurrenceScope: recurrenceScope?.value === "future" ? "future" : "this"
            }
          : {})
      };
    };
    const markDirty = () => {
      dirty = true;
      popover.addClass("is-auto-save-dirty");
    };
    const commit = () => {
      const draft = buildDraft();
      const signature = JSON.stringify(draft);
      if (!dirty || signature === lastCommittedSignature) {
        dirty = false;
        popover.removeClass("is-auto-save-dirty");
        return;
      }
      dirty = false;
      lastCommittedSignature = signature;
      popover.removeClass("is-auto-save-dirty");
      handlers.onEventUpdate?.(event, draft);
    };
    lastCommittedSignature = JSON.stringify(buildDraft());
    const editableFields = [title, date, start, end, calendar, allDayCheckbox, recurrence, recurrenceScope, location, notes, detailExtra.toggle].filter(isHTMLElement);
    for (const field of editableFields) {
      if (!field) continue;
      field.addEventListener("input", markDirty);
      field.addEventListener("change", markDirty);
      bindDetailCommitKeys(field, commit);
    }
  }
  if (event.url) {
    const actions = popover.createDiv({ cls: "task-hub-calendar-detail-actions" });
    const open = actions.createEl("button", { text: state.t("openSource") });
    open.addEventListener("click", () => {
      popover.win.open(event.url);
      closePopover();
    });
  }
  if (!editable) {
    popover.createDiv({ cls: "task-hub-detail-note", text: state.t("readOnly") });
  }
  renderCalendarNotes(popover, state.getEventNotes?.(event) ?? [], handlers, state);
}

function renderCalendarDetailExtraToggle(container: HTMLElement, state: CalendarViewState): { toggle: HTMLInputElement; extra: HTMLElement } {
  let toggle: HTMLInputElement | undefined;
  const toggleRow = detailRow(container, state.t("editDetails"), (icon) => {
    toggle = icon.createEl("input", { cls: "task-hub-detail-extra-toggle", type: "checkbox" }) as HTMLInputElement;
  });
  toggleRow.row.addClass("task-hub-detail-toggle-row");
  toggleRow.row.addClass("task-hub-calendar-detail-toggle");
  const extra = container.createDiv({ cls: "task-hub-detail-extra task-hub-calendar-detail-extra is-hidden" });
  if (!toggle) throw new Error("Detail toggle failed to render.");
  const renderedToggle = toggle;
  renderedToggle.addEventListener("change", () => {
    toggleDetailExtra(extra, renderedToggle.checked);
  });
  return { toggle: renderedToggle, extra };
}

function isHTMLElement(value: HTMLElement | undefined): value is HTMLElement {
  return value !== undefined;
}

function isImeComposingEnterEvent(event: KeyboardEvent): boolean {
  const keyCode = Number((event as KeyboardEvent & { keyCode?: number }).keyCode ?? 0);
  return Boolean(event.isComposing || keyCode === 229);
}

function bindDetailCommitKeys(field: HTMLElement, commit: () => void): void {
  field.addEventListener("keydown", (event) => {
    if (isImeComposingEnterEvent(event)) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    commit();
  });
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

function renderRecurrenceScopeSelect(container: HTMLElement, state: CalendarViewState): HTMLSelectElement {
  const row = detailRow(container, state.t("recurrenceApplyTo"));
  const select = row.control.createEl("select") as HTMLSelectElement;
  select.createEl("option", { value: "this", text: state.t("recurrenceThis") });
  select.createEl("option", { value: "future", text: state.t("recurrenceFuture") });
  select.value = "this";
  return select;
}

function renderReadonlyDetailRow(container: HTMLElement, label: string, value: string): HTMLElement {
  const row = detailRow(container, label);
  row.control.createDiv({ cls: "task-hub-calendar-detail-readonly-value", text: value });
  return row.row;
}

function recurrenceLabel(value: string | undefined, t: Translator): string {
  const preset = recurrencePresetFromRule(value);
  if (preset === "daily") return t("recurrenceDaily");
  if (preset === "weekly") return t("recurrenceWeekly");
  if (preset === "monthly") return t("recurrenceMonthly");
  if (preset === "yearly") return t("recurrenceYearly");
  if (preset === "custom") return t("recurrenceCustom");
  return t("recurrenceNone");
}

function renderCalendarNotes(
  container: HTMLElement,
  notes: TaskNote[],
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  if (!state.taskNotesEnabled || notes.length === 0) return;
  const notesContainer = container.createDiv({ cls: "task-hub-task-notes" });
  notesContainer.createEl("h4", { text: state.t("notes") });
  for (const note of notes) {
    const card = notesContainer.createDiv({ cls: "task-hub-task-note-card" });
    const menuButton = card.createEl("button", { cls: "task-hub-task-note-menu" });
    menuButton.setAttr("aria-label", state.t("more"));
    setIcon(menuButton, "more-horizontal");
    const openTaskNoteMenu = (event: MouseEvent) => {
      const menu = new Menu();
      menu.addItem((menuItem) => {
        menuItem
          .setTitle(state.t("delete"))
          .setIcon("trash")
          .onClick(() => handlers.onDeleteTaskNote?.(note.path));
      });
      menu.addItem((menuItem) => {
        menuItem
          .setTitle(state.t("edit"))
          .setIcon("pencil")
          .onClick(() => handlers.onOpenTaskNote?.(note.path));
      });
      menu.addItem((menuItem) => {
        menuItem
          .setTitle(state.t("taskNoteEditSource"))
          .setIcon("file-text")
          .onClick(() => handlers.onOpenTaskNoteSource?.(note.path));
      });
      if (state.allowThinoNoteEdit) {
        menu.addItem((menuItem) => {
          menuItem
            .setTitle(state.t("taskNoteEditInThino"))
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
    renderTaskNoteBody(card.createDiv({ cls: "task-hub-task-note-body" }), taskNotePreviewBody(note.body), note.path, state.renderNoteMarkdown);
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
  const row = container.createDiv({ cls: "task-hub-detail-row task-hub-calendar-detail-row" });
  const icon = row.createDiv({ cls: "task-hub-detail-icon-cell" });
  renderIcon?.(icon);
  const labelEl = row.createSpan({ cls: "task-hub-detail-label", text: label });
  const control = row.createDiv({ cls: "task-hub-detail-control" });
  return { row, icon, label: labelEl, control };
}

function detailInput(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  type = "text",
  renderIcon?: (icon: HTMLElement) => void
): HTMLInputElement {
  return detailInputField(container, label, value, type, renderIcon).input;
}

function detailInputField(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  type = "text",
  renderIcon?: (icon: HTMLElement) => void
): { field: HTMLElement; input: HTMLInputElement } {
  const row = detailRow(container, label, renderIcon);
  const input = row.control.createEl("input", { type }) as HTMLInputElement;
  input.value = value ?? "";
  if (type === "date") {
    input.addEventListener("click", () => openNativeDatePicker(input));
    input.addEventListener("focus", () => openNativeDatePicker(input));
  }
  return { field: row.row, input };
}

function detailCheckbox(container: HTMLElement, label: string): HTMLInputElement {
  let checkbox: HTMLInputElement | undefined;
  detailRow(container, label, (icon) => {
    checkbox = icon.createEl("input", { cls: "task-hub-calendar-detail-check", type: "checkbox" }) as HTMLInputElement;
  });
  if (!checkbox) throw new Error("Detail checkbox failed to render.");
  return checkbox;
}

function openNativeDatePicker(input: HTMLInputElement): void {
  input.showPicker?.();
}

function detailTextarea(container: HTMLElement, label: string, value: string | undefined): HTMLTextAreaElement {
  const row = detailRow(container, label);
  const textarea = row.control.createEl("textarea") as HTMLTextAreaElement;
  textarea.value = value ?? "";
  return textarea;
}

function detailAutoGrowTextarea(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  textareaClass?: string,
  renderIcon?: (icon: HTMLElement) => void
): HTMLTextAreaElement {
  const row = detailRow(container, label, renderIcon);
  const textarea = row.control.createEl("textarea", {
    cls: ["task-hub-auto-grow-textarea", textareaClass ?? ""].filter(Boolean).join(" ")
  }) as HTMLTextAreaElement;
  textarea.value = value ?? "";
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
  options: Array<{ id: string; name: string }>,
  value: string | undefined,
  inline = false
): HTMLSelectElement {
  const row = detailRow(container, label);
  if (inline) row.row.addClass("task-hub-calendar-detail-inline-row");
  const select = row.control.createEl("select") as HTMLSelectElement;
  for (const option of options) {
    select.createEl("option", { value: option.id, text: option.name });
  }
  if (value) select.value = value;
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
  const select = row.control.createEl("select", { cls: "task-hub-reminder-alert-select" }) as HTMLSelectElement;
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

function timeFromTask(task: TaskItem): string {
  return task.scheduledDate ? timeFromDateTime(task.scheduledDate) : "";
}

function timeFromDateTime(value: string | undefined): string {
  const parsed = parseZonedDateTime(value);
  if (parsed) {
    return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  }
  return value?.match(/T(\d{2}):(\d{2})/)?.slice(1, 3).join(":") ?? "";
}

function dateFromDateTime(value: string | undefined): string {
  const parsed = parseZonedDateTime(value);
  if (parsed) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return value?.slice(0, 10) ?? "";
}

function parseZonedDateTime(value: string | undefined): Date | undefined {
  if (!value || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function bindCalendarItemContextMenu(
  element: HTMLElement,
  item: CalendarItem,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (!item.task && !item.event) return;

  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const key = calendarItemSelectionKey(item);
    const keepSelection = activeSelectedCalendarItemKeys.has(key);
    if (keepSelection) {
      activeSelectedCalendarItemKey = calendarItemSelectionKey(item);
      syncCalendarSelectionClasses(element);
      if (item.task) handlers.onTaskSelectionChange?.(item.task, [...activeSelectedTaskIds]);
    } else {
      selectCalendarItem(element, item, event, handlers);
    }
    const menu = new Menu();
    const selectedItems = selectedCalendarItems(item);
    if (selectedItems.length > 1) {
      const selectedTasks = selectedItems.flatMap((selected) => selected.task ? [selected.task] : []);
      if (selectedTasks.length === selectedItems.length) {
        addCalendarTaskBulkMenuItems(menu, selectedTasks, state, handlers);
        menu.showAtMouseEvent(event);
        return;
      }
      addCalendarItemBulkMenuItems(menu, selectedItems, state, handlers);
      menu.showAtMouseEvent(event);
      return;
    }
    let itemCount = 0;
    if (item.task) {
      addSourceIndicatorMenuItem(menu, sourceIndicatorLabelForTask(item.task, state.t));
      itemCount += 1;
    } else if (item.event) {
      addSourceIndicatorMenuItem(menu, sourceIndicatorLabelForEvent(item.event, state.t));
      itemCount += 1;
    }
    if (state.taskNotesEnabled && item.task) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("createTaskNote"))
          .setIcon("sticky-note")
          .onClick(() => {
            if (item.task) handlers.onCreateTaskNote?.(item.task);
          });
      });
    }
    if (state.taskNotesEnabled && item.event) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("createTaskNote"))
          .setIcon("sticky-note")
          .onClick(() => {
            if (item.event) handlers.onCreateEventNote?.(item.event);
          });
      });
    }
    if (item.task) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("openSource"))
          .setIcon("external-link")
          .onClick(() => {
            if (item.task) handlers.onTaskJump(item.task);
          });
      });
    }
    if (item.task && canDeleteTask(item, state)) {
      const task = item.task;
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(deleteLabelForTask(task, state.t))
          .setIcon("trash")
          .onClick(() => {
            handlers.onTaskDelete?.(task);
          });
      });
    }
    if (item.event && canDeleteEvent(item, state)) {
      const calendarEvent = item.event;
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(deleteLabelForEvent(calendarEvent, state.t))
          .setIcon("trash")
          .onClick(() => {
            handlers.onEventDelete?.(calendarEvent);
          });
      });
    }
    if (item.task && canSendTaskToAppleReminders(item, state)) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("sendToAppleReminders"))
          .setIcon("bell-plus")
          .onClick(() => {
            const task = item.task;
            if (task) {
              markCalendarItemExternalSending(item);
              handlers.onTaskSendToAppleReminders?.(task);
            }
          });
      });
    }
    if (item.task && canSendTaskToDida(item, state)) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("sendToDida"))
          .setIcon("send")
          .onClick(() => {
            const task = item.task;
            if (task) {
              markCalendarItemExternalSending(item);
              handlers.onTaskSendToDida?.(task);
            }
          });
      });
    }
    if (item.task && canSendAppleReminderToCalendar(item, state)) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("sendToAppleCalendar"))
          .setIcon("calendar-plus")
          .onClick(() => {
            const task = item.task;
            if (task) {
              markCalendarItemExternalSending(item);
              handlers.onTaskSendToAppleCalendar?.(task);
            }
          });
      });
    }
    if (item.event && canSendAppleCalendarEventToReminders(item, state)) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("sendToAppleReminders"))
          .setIcon("bell-plus")
          .onClick(() => {
            const event = item.event;
            if (event) {
              markCalendarItemExternalSending(item);
              handlers.onEventSendToAppleReminders?.(event);
            }
          });
      });
    }
    if (itemCount === 0) {
      menu.addItem((menuItem) => {
        menuItem
          .setTitle(state.t("sendToAppleRemindersDisabled"))
          .setIcon("bell-off")
          .onClick(() => undefined);
      });
    }
    menu.showAtMouseEvent(event);
  });
}

function selectedCalendarItems(anchorItem: CalendarItem): CalendarItem[] {
  const anchorKey = calendarItemSelectionKey(anchorItem);
  if (!activeSelectedCalendarItemKeys.has(anchorKey)) {
    activeSelectedCalendarItemKeys = new Set([anchorKey]);
  }
  const items = new Map<string, CalendarItem>();
  for (const key of activeSelectedCalendarItemKeys) {
    const elements = activeCalendarItemElements.get(key) ?? [];
    for (const element of elements) {
      const item = calendarItemByElement(element);
      if (item) items.set(calendarItemSelectionKey(item), item);
    }
  }
  items.set(anchorKey, anchorItem);
  return [...items.values()];
}

function calendarItemByElement(element: HTMLElement): CalendarItem | undefined {
  return (element as HTMLElement & { taskHubCalendarItem?: CalendarItem }).taskHubCalendarItem;
}

function addCalendarTaskBulkMenuItems(
  menu: Menu,
  tasks: TaskItem[],
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (tasks.length === 1) {
    addSourceIndicatorMenuItem(menu, sourceIndicatorLabelForTask(tasks[0], state.t));
  }
  const actions = resolveTaskBulkActions(tasks, {
    allowAppleReminderWriteback: state.allowAppleReminderWriteback,
    allowAppleReminderCreate: state.allowAppleReminderCreate,
    allowAppleCalendarReminderConversion: state.allowAppleCalendarReminderConversion,
    allowDidaCreate: state.allowDidaCreate,
    allowDidaWriteback: state.allowDidaWriteback,
    allowDidaDelete: state.allowDidaDelete,
    taskNotesEnabled: state.taskNotesEnabled
  });

  for (const action of actions) {
    menu.addItem((menuItem) => {
      const spec = calendarTaskBulkMenuSpec(action.id, tasks, state);
      menuItem
        .setTitle(spec.title)
        .setIcon(spec.icon)
        .onClick(() => runCalendarTaskBulkAction(action.id, tasks, handlers));
    });
  }
}

function addCalendarItemBulkMenuItems(
  menu: Menu,
  items: CalendarItem[],
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (!items.every((item) => canDeleteCalendarItem(item, state))) return;
  menu.addItem((menuItem) => {
    menuItem
      .setTitle(state.t("deleteCalendarItem"))
      .setIcon("trash")
      .onClick(() => {
        for (const item of items) {
          if (item.task) handlers.onTaskDelete?.(item.task);
          if (item.event) handlers.onEventDelete?.(item.event);
        }
      });
  });
}

function calendarTaskBulkMenuSpec(action: TaskBulkActionId, tasks: TaskItem[], state: CalendarViewState): { title: string; icon: string } {
  if (action === "create-note") return { title: state.t("createTaskNote"), icon: "sticky-note" };
  if (action === "mark-complete") return { title: state.t("markComplete"), icon: "check-square" };
  if (action === "mark-open") return { title: state.t("markOpen"), icon: "square" };
  if (action === "open-source") return { title: state.t("openSource"), icon: "external-link" };
  if (action === "send-to-dida") return { title: state.t("sendToDida"), icon: "send" };
  if (action === "send-to-apple-reminders") return { title: state.t("sendToAppleReminders"), icon: "bell-plus" };
  if (action === "send-to-apple-calendar") return { title: state.t("sendToAppleCalendar"), icon: "calendar-plus" };
  return { title: deleteLabelForTaskBulkAction(action, tasks, state.t), icon: "trash" };
}

function runCalendarTaskBulkAction(action: TaskBulkActionId, tasks: TaskItem[], handlers: CalendarViewHandlers): void {
  for (const task of tasks) {
    if (action === "create-note") handlers.onCreateTaskNote?.(task);
    else if (action === "mark-complete" || action === "mark-open") handlers.onTaskComplete(task);
    else if (action === "open-source") handlers.onTaskJump(task);
    else if (action === "delete") handlers.onTaskDelete?.(task);
    else if (action === "send-to-apple-reminders") handlers.onTaskSendToAppleReminders?.(task);
    else if (action === "send-to-dida") handlers.onTaskSendToDida?.(task);
    else if (action === "send-to-apple-calendar") handlers.onTaskSendToAppleCalendar?.(task);
  }
}

function markCalendarItemExternalSending(item: CalendarItem): void {
  const key = calendarItemSelectionKey(item);
  for (const element of activeCalendarItemElements.get(key) ?? []) {
    element.addClass("is-external-sending");
  }
}

function bindCalendarItemDrag(element: HTMLElement, item: CalendarItem, state: CalendarViewState, hourHeight = HOUR_HEIGHT): void {
  if (!canDragCalendarItem(item, state)) return;

  element.draggable = true;
  element.setAttr("draggable", "true");
  element.setAttr("aria-grabbed", "false");
  element.addEventListener("pointerdown", (event) => {
    const grabOffset = dragGrabOffset(element, event, item, hourHeight);
    activeDragGrabOffsetMinutes = grabOffset?.minutes ?? 0;
    activeDragGrabOffsetXPixels = grabOffset?.xPixels ?? 0;
    activeDragGrabOffsetYPixels = grabOffset?.yPixels ?? 0;
  });
  element.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    activeDraggedCalendarItemId = item.id;
    const grabOffset = dragGrabOffset(element, event, item, hourHeight);
    activeDragGrabOffsetMinutes = grabOffset?.minutes ?? activeDragGrabOffsetMinutes;
    activeDragGrabOffsetXPixels = grabOffset?.xPixels ?? activeDragGrabOffsetXPixels;
    activeDragGrabOffsetYPixels = grabOffset?.yPixels ?? activeDragGrabOffsetYPixels;
    activeDraggedElementReference = element;
    activeDetailsElement?.remove();
    activeDetailsElement = undefined;
    element.addClass("is-dragging");
    element.setAttr("aria-grabbed", "true");
    const selectedItems = selectedDraggableCalendarItems(item, currentVisibleCalendarItems(), state);
    const usingCustomDragStack = startCalendarStackDragFeedback(element, item, selectedItems, event);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(CALENDAR_ITEM_DRAG_MIME, item.id);
      if (item.kind === "task") {
        event.dataTransfer.setData(TASK_DRAG_MIME, item.id);
      }
      if (usingCustomDragStack) setNativeDragGhost(event.dataTransfer, element);
    }
  });
  element.addEventListener("dragend", () => {
    element.removeClass("is-dragging");
    clearCalendarDragFeedback();
    activeDraggedCalendarItemId = undefined;
    if (activeDraggedElementReference === element) activeDraggedElementReference = undefined;
    activeDragGrabOffsetMinutes = 0;
    activeDragGrabOffsetXPixels = 0;
    activeDragGrabOffsetYPixels = 0;
    element.setAttr("aria-grabbed", "false");
  });
}

function bindCalendarDropTarget(
  element: HTMLElement,
  dateKey: string,
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  element.addEventListener("dragover", (event) => {
    if (!isTaskHubDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    element.addClass("is-drop-hover");
    updateCalendarDragStack(event);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });
  element.addEventListener("dragleave", () => {
    element.removeClass("is-drop-hover");
  });
  element.addEventListener("drop", (event) => {
    const dragItems = draggableCalendarItems(visibleItems, state);
    const item = calendarItemFromDragEvent(event, dragItems, state);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    element.removeClass("is-drop-hover");
    playCalendarDropScatter(element, selectedDraggableCalendarItems(item, dragItems, state));
    rescheduleCalendarItemSelection(item, dateKey, dragItems, handlers, state);
  });
}

function bindCalendarTimedDropTarget(
  element: HTMLElement,
  dateKey: string,
  startHour: number,
  hourHeight: number,
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  element.addEventListener("dragover", (event) => {
    if (!isTaskHubDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    element.addClass("is-drop-hover");
    updateCalendarDragStack(event);
    const item = calendarItemFromDragEvent(event, draggableCalendarItems(visibleItems, state), state);
    if (item) {
      const target = timedDropTarget(element, event, item, dateKey, startHour, hourHeight, state);
      updateDragMoveFeedback(item, target, event);
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });
  element.addEventListener("dragleave", () => {
    element.removeClass("is-drop-hover");
    clearDragMoveFeedback();
  });
  element.addEventListener("drop", (event) => {
    const dragItems = draggableCalendarItems(visibleItems, state);
    const item = calendarItemFromDragEvent(event, dragItems, state);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    element.removeClass("is-drop-hover");
    const target = timedDropTarget(element, event, item, dateKey, startHour, hourHeight, state);
    playCalendarDropScatter(element, selectedDraggableCalendarItems(item, dragItems, state), event);
    clearDragMoveFeedback();
    rescheduleCalendarItemSelection(item, target, dragItems, handlers, state);
  });
}

function rescheduleCalendarItemSelection(
  draggedItem: CalendarItem,
  target: CalendarDropTarget,
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  const selectedItems = selectedDraggableCalendarItems(draggedItem, visibleItems, state);
  if (selectedItems.length <= 1) {
    rescheduleCalendarItem(draggedItem, target, handlers);
    return;
  }

  for (const item of selectedItems) {
    rescheduleCalendarItem(item, selectedCalendarDropTarget(draggedItem, item, target, state), handlers);
  }
}

function selectedDraggableCalendarItems(draggedItem: CalendarItem, visibleItems: CalendarItem[], state: CalendarViewState): CalendarItem[] {
  const draggedKey = calendarItemSelectionKey(draggedItem);
  if (!activeSelectedCalendarItemKeys.has(draggedKey)) return [draggedItem];
  const selectedKeys = new Set(activeSelectedCalendarItemKeys);
  const selectedItems = visibleItems.filter((item) => selectedKeys.has(calendarItemSelectionKey(item)) && canDragCalendarItem(item, state));
  return selectedItems.some((item) => calendarItemSelectionKey(item) === draggedKey) ? selectedItems : [draggedItem];
}

function draggableCalendarItems(visibleItems: CalendarItem[], state: CalendarViewState): CalendarItem[] {
  const items = new Map<string, CalendarItem>();
  for (const item of [...visibleItems, ...unscheduledTaskCalendarItems(state)]) {
    items.set(calendarItemSelectionKey(item), item);
  }
  for (const item of currentVisibleCalendarItems()) {
    items.set(calendarItemSelectionKey(item), item);
  }
  return [...items.values()];
}

function unscheduledTaskCalendarItems(state: CalendarViewState): CalendarItem[] {
  return (state.unscheduledTasks ?? []).map((task) => unscheduledTaskCalendarItem(task, state));
}

function unscheduledTaskCalendarItem(task: TaskItem, state: CalendarViewState): CalendarItem {
  return {
    id: `task:${task.id}`,
    title: task.text,
    date: "",
    allDay: true,
    sourceId: task.source,
    kind: "task",
    color: task.externalListId ? state.taskColors?.[task.externalListId] : undefined,
    task
  };
}

function currentVisibleCalendarItems(): CalendarItem[] {
  const items = new Map<string, CalendarItem>();
  for (const elements of activeCalendarItemElements.values()) {
    for (const element of elements) {
      const item = calendarItemByElement(element);
      if (item) items.set(calendarItemSelectionKey(item), item);
    }
  }
  return [...items.values()];
}

function startCalendarStackDragFeedback(
  draggedElement: HTMLElement,
  draggedItem: CalendarItem,
  selectedItems: CalendarItem[],
  event: DragEvent
): boolean {
  clearCalendarDragStack();
  const items = orderedDragStackItems(draggedItem, selectedItems).slice(0, 6);
  if (items.length <= 1) return false;
  muteSelectedCalendarElements(draggedElement, items);
  const ownerDocument = draggedElement.doc;
  const body = ownerDocument.body;
  if (!body) return false;
  const stack = ownerDocument.createElement("div");
  stack.addClass("task-hub-calendar-drag-stack");
  stack.setAttr("aria-hidden", "true");
  setCssProps(stack, { "--task-hub-drag-stack-count": String(items.length) });
  items.forEach((item, index) => {
    const card = stack.createDiv({ cls: `task-hub-calendar-drag-stack-card ${item.kind === "task" ? "is-task" : "is-event"}` });
    setCssProps(card, {
      "--task-hub-drag-stack-x": `${index * 9}px`,
      "--task-hub-drag-stack-y": `${index * 7}px`,
      "--task-hub-drag-stack-rotate": `${(index - 1) * -1.5}deg`,
      "--task-hub-drag-stack-from-x": `${(index - 2) * -18}px`,
      "--task-hub-drag-stack-from-y": `${(index - 1) * 20}px`,
      "--task-hub-drag-stack-color": item.color ?? "var(--interactive-accent)"
    });
    if (item.startMinutes !== undefined && item.endMinutes !== undefined) {
      card.createSpan({ cls: "task-hub-calendar-drag-stack-time", text: formatTimeRange(item.startMinutes, item.endMinutes) });
    }
    card.createSpan({ cls: "task-hub-calendar-drag-stack-title", text: item.title });
  });
  if (selectedItems.length > items.length) {
    stack.createDiv({ cls: "task-hub-calendar-drag-stack-more", text: `+${selectedItems.length - items.length}` });
  }
  body.appendChild(stack);
  activeDragStackElement = stack;
  positionCalendarDragStack(stack, event);
  return true;
}

function orderedDragStackItems(draggedItem: CalendarItem, selectedItems: CalendarItem[]): CalendarItem[] {
  const draggedKey = calendarItemSelectionKey(draggedItem);
  return [
    draggedItem,
    ...selectedItems.filter((item) => calendarItemSelectionKey(item) !== draggedKey)
  ];
}

function muteSelectedCalendarElements(draggedElement: HTMLElement, items: CalendarItem[]): void {
  activeMutedDragElements = [];
  for (const item of items) {
    for (const element of activeCalendarItemElements.get(calendarItemSelectionKey(item)) ?? []) {
      if (element === draggedElement) continue;
      element.addClass("is-drag-muted");
      activeMutedDragElements.push(element);
    }
  }
}

function positionCalendarDragStack(stack: HTMLElement, event: DragEvent): void {
  const x = event.clientX - activeDragGrabOffsetXPixels + 16;
  const y = event.clientY - activeDragGrabOffsetYPixels + 16;
  setCssStyles(stack, { left: `${Math.max(8, x)}px`, top: `${Math.max(8, y)}px` });
}

function updateCalendarDragStack(event: DragEvent): void {
  if (!activeDragStackElement) return;
  positionCalendarDragStack(activeDragStackElement, event);
}

function setNativeDragGhost(dataTransfer: DataTransfer, element: HTMLElement): void {
  const ownerDocument = element.doc;
  const ghost = ownerDocument.createElement("div");
  ghost.addClass("task-hub-calendar-native-drag-ghost");
  ownerDocument.body.appendChild(ghost);
  dataTransfer.setDragImage?.(ghost, 0, 0);
  deferredCleanup(element.win, () => ghost.remove(), 0);
}

function playCalendarDropScatter(targetElement: HTMLElement, selectedItems: CalendarItem[], event?: DragEvent): void {
  if (selectedItems.length <= 1) {
    clearCalendarDragStack();
    return;
  }
  const ownerDocument = targetElement.doc;
  const body = ownerDocument.body;
  if (!body) {
    clearCalendarDragStack();
    return;
  }
  const rect = targetElement.getBoundingClientRect();
  const x = event?.clientX ?? rect.left + rect.width / 2;
  const y = event?.clientY ?? rect.top + Math.min(72, Math.max(24, rect.height / 2));
  const burst = ownerDocument.createElement("div");
  burst.addClass("task-hub-calendar-drop-scatter");
  setCssStyles(burst, { left: `${Math.max(8, x)}px`, top: `${Math.max(8, y)}px` });
  selectedItems.slice(0, 5).forEach((item, index) => {
    const chip = burst.createDiv({ cls: "task-hub-calendar-drop-scatter-chip" });
    const offsetIndex = index - Math.floor(Math.min(5, selectedItems.length) / 2);
    setCssProps(chip, {
      "--task-hub-drop-scatter-x": `${offsetIndex * 24}px`,
      "--task-hub-drop-scatter-y": `${Math.abs(offsetIndex) * 12}px`,
      "--task-hub-drop-scatter-mid-x": `${offsetIndex * 18}px`,
      "--task-hub-drop-scatter-mid-y": `${Math.abs(offsetIndex) * 9}px`,
      "--task-hub-drop-scatter-color": item.color ?? "var(--interactive-accent)"
    });
  });
  body.appendChild(burst);
  deferredCleanup(targetElement.win, () => burst.remove(), 520);
  clearCalendarDragStack();
}

function deferredCleanup(ownerWindow: Window, callback: () => void, delay: number): void {
  ownerWindow.setTimeout(callback, delay);
}

function selectedCalendarDropTarget(
  draggedItem: CalendarItem,
  item: CalendarItem,
  target: CalendarDropTarget,
  state: CalendarViewState
): CalendarDropTarget {
  if (typeof target !== "string") {
    const targetStartMinutes = target.startMinutes;
    const draggedStartMinutes = draggedItem.startMinutes;
    if (targetStartMinutes !== undefined && draggedStartMinutes !== undefined) {
      return sharedCalendarTimedDropTarget(item, draggedStartMinutes, target.dateKey, targetStartMinutes, state);
    }
  }
  return sharedCalendarDropTarget(item, target, state);
}

function sharedCalendarDropTarget(
  item: CalendarItem,
  target: CalendarDropTarget,
  state: CalendarViewState
): CalendarDropTarget {
  if (typeof target === "string") return target;
  if (target.startMinutes === undefined) {
    return item.kind === "event"
      ? { dateKey: target.dateKey, durationMinutes: itemDurationMinutes(item, state) }
      : target.dateKey;
  }
  if (item.kind === "event") {
    return {
      dateKey: target.dateKey,
      startMinutes: target.startMinutes,
      durationMinutes: itemDurationMinutes(item, state)
    };
  }
  return {
    dateKey: target.dateKey,
    startMinutes: target.startMinutes
  };
}

function sharedCalendarTimedDropTarget(
  item: CalendarItem,
  draggedStartMinutes: number,
  dateKey: string,
  targetStartMinutes: number,
  state: CalendarViewState
): CalendarDropTarget {
  const originalStartMinutes = item.startMinutes ?? draggedStartMinutes;
  const relativeStartMinutes = snapDayStartTime(targetStartMinutes + originalStartMinutes - draggedStartMinutes);
  if (item.kind === "event") {
    return {
      dateKey,
      startMinutes: relativeStartMinutes,
      durationMinutes: itemDurationMinutes(item, state)
    };
  }
  return {
    dateKey,
    startMinutes: relativeStartMinutes
  };
}

function rescheduleCalendarItem(item: CalendarItem, target: CalendarDropTarget, handlers: CalendarViewHandlers): void {
  if (item.task) {
    handlers.onTaskReschedule(item.task, target);
    return;
  }
  if (item.event) {
    handlers.onEventReschedule?.(item.event, target);
  }
}

function timedDropTarget(
  element: HTMLElement,
  event: DragEvent,
  item: CalendarItem,
  dateKey: string,
  startHour: number,
  hourHeight: number,
  state: CalendarViewState
): CalendarDropTarget {
  const startMinutes = adjustedDraggedStartMinutes(element, event, item, startHour, hourHeight);
  if (item.kind === "task") {
    return {
      dateKey,
      startMinutes
    };
  }
  return {
    dateKey,
    startMinutes,
    durationMinutes: itemDurationMinutes(item, state)
  };
}

function adjustedDraggedStartMinutes(element: HTMLElement, event: DragEvent, item: CalendarItem, startHour: number, hourHeight: number): number {
  const pointerMinutes = minutesFromColumnEvent(element, event, startHour, hourHeight);
  const offsetMinutes = item.startMinutes === undefined ? 0 : activeDragGrabOffsetMinutes;
  return snapDayStartTime(pointerMinutes - offsetMinutes);
}

function updateDragMoveFeedback(item: CalendarItem, target: CalendarDropTarget, event: DragEvent): void {
  if (typeof target === "string" || item.startMinutes === undefined || target.startMinutes === undefined || target.dateKey !== item.date) {
    clearDragMoveFeedback();
    return;
  }
  const feedback = dragFeedbackElement();
  if (!feedback) return;
  feedback.textContent = formatMinuteDelta(target.startMinutes - item.startMinutes);
  positionDragMoveFeedback(feedback, event);
  const draggedElement = activeDraggedElement();
  draggedElement?.addClass("has-drag-feedback");
}

function clearDragMoveFeedback(): void {
  const draggedElement = activeDraggedElement();
  draggedElement?.removeClass("has-drag-feedback");
  activeDragFeedbackElement?.remove();
  activeDragFeedbackElement = undefined;
}

function clearCalendarDragFeedback(): void {
  clearDragMoveFeedback();
  clearCalendarDragStack();
}

function clearCalendarDragStack(): void {
  activeDragStackElement?.remove();
  activeDragStackElement = undefined;
  for (const element of activeMutedDragElements) {
    element.removeClass("is-drag-muted");
  }
  activeMutedDragElements = [];
}

function activeDraggedElement(): HTMLElement | undefined {
  if (activeDraggedElementReference?.hasClass("is-dragging")) return activeDraggedElementReference;
  return undefined;
}

function dragFeedbackElement(): HTMLElement | undefined {
  if (activeDragFeedbackElement) return activeDragFeedbackElement;
  const ownerDocument = activeDraggedElement()?.doc;
  if (!ownerDocument) return undefined;
  const body = ownerDocument.body;
  if (!body) return undefined;
  const feedback = ownerDocument.createElement("div");
  feedback.addClass("task-hub-calendar-drag-feedback");
  body.appendChild(feedback);
  activeDragFeedbackElement = feedback;
  return feedback;
}

function positionDragMoveFeedback(feedback: HTMLElement, event: DragEvent): void {
  const x = event.clientX - activeDragGrabOffsetXPixels + 48;
  const y = event.clientY - activeDragGrabOffsetYPixels + 44;
  setCssStyles(feedback, { left: `${Math.max(8, x)}px`, top: `${Math.max(8, y)}px` });
}

function validDurationMinutes(value: number | undefined): number {
  return validTimedDurationMinutes(value, DEFAULT_TIMED_TASK_DURATION_MINUTES);
}

function itemDurationMinutes(item: CalendarItem, state: CalendarViewState): number {
  if (item.kind === "task") return MIN_TIMED_ITEM_DURATION_MINUTES;
  if (item.startMinutes !== undefined && item.endMinutes !== undefined) {
    return validDurationMinutes(item.endMinutes - item.startMinutes);
  }
  return validDurationMinutes(state.defaultTimedTaskDurationMinutes);
}

function minutesFromColumnEvent(element: HTMLElement, event: { clientY: number }, startHour: number, hourHeight: number): number {
  const rect = element.getBoundingClientRect();
  const offset = Math.max(0, event.clientY - rect.top);
  const rawMinutes = startHour * 60 + (offset / hourHeight) * 60;
  return snapDayStartTime(rawMinutes);
}

function dragGrabOffset(element: HTMLElement, event: { clientX: number; clientY: number }, item: CalendarItem, hourHeight: number): { minutes: number; xPixels: number; yPixels: number } | undefined {
  if (item.startMinutes === undefined) return { minutes: 0, xPixels: 0, yPixels: 0 };
  const rect = element.getBoundingClientRect();
  const offsetYPixels = event.clientY - rect.top;
  const offsetXPixels = event.clientX - rect.left;
  if (!Number.isFinite(offsetYPixels) || offsetYPixels < 0) return undefined;
  const durationMinutes = Math.max(MIN_TIMED_ITEM_DURATION_MINUTES, itemEndMinutes(item) - item.startMinutes);
  return {
    minutes: Math.max(0, Math.min(durationMinutes, snapToTimeGranularity((offsetYPixels / hourHeight) * 60))),
    xPixels: Number.isFinite(offsetXPixels) && offsetXPixels > 0 ? offsetXPixels : 0,
    yPixels: offsetYPixels
  };
}

function snapDayStartTime(value: number): number {
  return snapDayStartMinutes(value);
}

function clampDayMinutes(value: number): number {
  return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

function calendarItemFromDragEvent(event: DragEvent, visibleItems: CalendarItem[], state: CalendarViewState): CalendarItem | undefined {
  const draggedId = activeDraggedCalendarItemId ?? event.dataTransfer?.getData(CALENDAR_ITEM_DRAG_MIME) ?? event.dataTransfer?.getData(TASK_DRAG_MIME);
  if (!draggedId) return undefined;
  return visibleItems.find((item) => (item.id === draggedId || item.task?.id === draggedId) && canDragCalendarItem(item, state));
}

function isTaskHubDrag(event: DragEvent): boolean {
  if (activeDraggedCalendarItemId) return true;
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes(CALENDAR_ITEM_DRAG_MIME) || types.includes(TASK_DRAG_MIME);
}

function canDragCalendarItem(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.kind === "event") {
    return isWritableAppleCalendarEvent(item, state) && Boolean(state.allowAppleCalendarWriteback);
  }
  if (item.task?.source === "vault") return true;
  if (item.task?.source === "dida") return Boolean(state.allowDidaWriteback && state.allowDidaDragReschedule && item.task.externalId);
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canResizeCalendarItem(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.allDay || item.startMinutes === undefined) return false;
  if (item.kind === "task") return false;
  if (item.kind === "event") {
    return isWritableAppleCalendarEvent(item, state) && Boolean(state.allowAppleCalendarWriteback);
  }
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canDeleteTask(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.task?.source === "vault") return true;
  if (item.task?.source === "dida") return Boolean(state.allowDidaDelete && item.task.externalId);
  return item.task?.source === "apple-reminders" && canDeleteAppleReminderCapability({
    enabled: Boolean(state.localAppleEnabled),
    remindersEnabled: Boolean(state.localAppleRemindersEnabled)
  }, Boolean(state.localAppleSupported), item.task.externalId);
}

function canDeleteEvent(item: CalendarItem, state: CalendarViewState): boolean {
  return canDeleteAppleCalendarEventCapability(
    {
      enabled: Boolean(state.localAppleEnabled),
      calendarEnabled: Boolean(state.localAppleCalendarEnabled)
    },
    Boolean(state.localAppleSupported),
    isWritableAppleCalendarEvent(item, state),
    item.event?.id
  );
}

function canDeleteCalendarItem(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.task) return canDeleteTask(item, state);
  if (item.event) return canDeleteEvent(item, state);
  return false;
}

function canSendTaskToAppleReminders(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(state.allowAppleReminderCreate && item.task?.source === "vault");
}

function canSendTaskToDida(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(state.allowDidaCreate && item.task?.source === "vault");
}

function canSendAppleReminderToCalendar(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(
    state.allowAppleCalendarReminderConversion &&
      item.task?.source === "apple-reminders" &&
      item.task.externalId &&
      item.task.dueDate
  );
}

function canSendAppleCalendarEventToReminders(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(
    state.allowAppleCalendarReminderConversion &&
      isWritableAppleCalendarEvent(item, state)
  );
}

function isWritableAppleCalendarEvent(item: CalendarItem, state: CalendarViewState): boolean {
  const event = item.event;
  if (event?.sourceId !== "apple-calendar" || !event.id) return false;
  if (!event.calendarId) return true;
  return state.appleCalendars?.find((calendar) => calendar.id === event.calendarId)?.writable !== false;
}

function taskPointTopPixels(startMinutes: number, hourHeight: number): number {
  return (startMinutes / 60) * hourHeight;
}

function visualMinutesForPixels(pixels: number, hourHeight: number): number {
  return (pixels / hourHeight) * 60;
}

function calendarItemClass(item: CalendarItem, extraClass = ""): string {
  return [
    "task-hub-calendar-item",
    `is-${item.kind}`,
    item.kind === "task" && item.task?.completed ? "is-completed" : "",
    item.isMultiDay ? "is-multi-day" : "",
    item.isMultiDayStart ? "is-multi-day-start" : "",
    item.isMultiDayEnd ? "is-multi-day-end" : "",
    extraClass
  ]
    .filter(Boolean)
    .join(" ");
}

function renderCalendarItemContent(
  row: HTMLElement,
  item: CalendarItem,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  timeLabel?: string
): void {
  const task = item.task;
  if (task) {
    row.addClass("has-checkbox");
    const checkbox = row.createEl("input", { type: "checkbox" });
    checkbox.checked = task.completed;
    checkbox.disabled = !canToggleCalendarTask(task, state);
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onTaskComplete(task);
    });
  }
  const body = row.createDiv({ cls: "task-hub-calendar-item-body" });
  if (timeLabel) body.createSpan({ cls: "task-hub-calendar-item-time", text: timeLabel });
  body.createSpan({ cls: "task-hub-calendar-item-title", text: item.title });
}

function canToggleCalendarTask(task: TaskItem, state: CalendarViewState): boolean {
  return (
    task.source === "vault" ||
    (task.source === "apple-reminders" && state.allowAppleReminderWriteback) ||
    (task.source === "dida" && Boolean(state.allowDidaWriteback && task.externalId))
  );
}

function shortWeekday(date: Date, t: Translator): string {
  return date.toLocaleDateString(t.locale ?? "en-US", { weekday: "short" });
}

function calendarTitle(date: Date, mode: CalendarViewMode, t: Translator, showLunarCalendar?: boolean): string {
  const locale = t.locale ?? "en-US";
  if (mode === "day") {
    return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  }
  const solarTitle = date.toLocaleDateString(locale, { year: "numeric", month: "long" });
  if (mode !== "month" || !showLunarCalendar) return solarTitle;
  const lunarTitle = formatLunarMonthTitle(date);
  return lunarTitle ? `${solarTitle} · ${lunarTitle}` : solarTitle;
}

function itemSummary(taskCount: number, eventCount: number, t: Translator): string {
  if (taskCount > 0 && eventCount > 0) return `${taskCount} ${t("task")} · ${eventCount} ${t("event")}`;
  if (taskCount > 0) return `${taskCount} ${t("task")}`;
  return `${eventCount} ${t("event")}`;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`;
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
