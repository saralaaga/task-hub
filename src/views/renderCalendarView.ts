import { Menu } from "obsidian";
import { buildCalendarItems, calendarEventLayerId, getCalendarRange, type CalendarItem, type CalendarViewMode } from "../calendar/calendarModel";
import { toLocalDateKey } from "../calendar/dateBuckets";
import { formatLunarDayLabel, formatLunarMonthTitle } from "../calendar/lunarCalendar";
import type { TranslationKey, Translator } from "../i18n";
import type { CalendarEvent, CalendarSource, CalendarSourceStatus, TaskItem, WeekStart } from "../types";

export type CalendarViewState = {
  mode: CalendarViewMode;
  focusDate: Date;
  weekStart: WeekStart;
  visibleSourceIds: Set<string>;
  includeCompletedTasks: boolean;
  allowAppleReminderWriteback: boolean;
  allowAppleReminderCreate?: boolean;
  allowAppleCalendarWriteback?: boolean;
  allowTaskCreation: boolean;
  showLunarCalendar?: boolean;
  today?: Date;
  defaultTimedTaskDurationMinutes?: number;
  taskDurationOverrides?: Record<string, number>;
  sources: CalendarSource[];
  t: Translator;
};

export type CalendarDropTarget =
  | string
  | {
      dateKey: string;
      startMinutes?: number;
      durationMinutes?: number;
    };

export type CalendarViewHandlers = {
  onModeChange: (mode: CalendarViewMode) => void;
  onMove: (direction: -1 | 1) => void;
  onToday: () => void;
  onLayerToggle: (sourceId: string) => void;
  onDateCreateTask: (target: CalendarDropTarget) => void;
  onTaskComplete: (task: TaskItem) => void;
  onTaskJump: (task: TaskItem) => void;
  onTaskSelect: (task: TaskItem) => void;
  onTaskReschedule: (task: TaskItem, target: CalendarDropTarget) => void;
  onTaskDelete?: (task: TaskItem) => void;
  onTaskSendToAppleReminders?: (task: TaskItem) => void;
  onEventReschedule?: (event: CalendarEvent, target: CalendarDropTarget) => void;
  onEventDelete?: (event: CalendarEvent) => void;
};

const MODE_LABEL_KEYS: Record<CalendarViewMode, TranslationKey> = {
  day: "day",
  week: "week",
  month: "month"
};
const HOUR_HEIGHT = 56;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;
const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;
const DEFAULT_MONTH_CREATION_START_MINUTES = 9 * 60;
const TASK_TIME_POINT_HEIGHT = 28;
const TASK_TIME_POINT_GAP = 4;
const MIN_TIMED_ITEM_DURATION_MINUTES = 15;
const CALENDAR_ITEM_DRAG_MIME = "application/x-task-hub-calendar-item-id";
const TASK_DRAG_MIME = "application/x-task-hub-task-id";
let activeDraggedCalendarItemId: string | undefined;
let activeDragGrabOffsetMinutes = 0;
let activeDragGrabOffsetXPixels = 0;
let activeDragGrabOffsetYPixels = 0;
let activeDragFeedbackElement: HTMLElement | undefined;
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
  stackIndex?: number;
};

export function renderCalendarView(
  container: HTMLElement,
  state: CalendarViewState,
  tasks: TaskItem[],
  events: CalendarEvent[],
  handlers: CalendarViewHandlers
): void {
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
    taskDurationOverrides: state.taskDurationOverrides
  });
  const visibleItems = items.filter((item) => item.date >= range.start && item.date <= range.end);

  if (visibleItems.length === 0) {
    container.createDiv({ cls: "task-hub-empty", text: state.t("calendarEmpty") });
  }

  if (state.mode === "day" || state.mode === "week") {
    renderAgendaGrid(container, state, range.days, visibleItems, handlers, today);
    return;
  }

  renderMonthGrid(container, state, range.days, visibleItems, handlers, today);
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
    header.createSpan({ cls: "task-hub-calendar-weekday", text: shortWeekday(dayDate) });
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
  const startHour = Math.min(DEFAULT_START_HOUR, ...timedItems.map((item) => Math.floor((item.startMinutes ?? 0) / 60)));
  const endHour = Math.max(
    DEFAULT_END_HOUR,
    ...timedItems.map((item) => Math.ceil(((item.endMinutes ?? (item.startMinutes ?? 0) + 60) || 60) / 60))
  );
  const hourCount = Math.max(1, endHour - startHour);
  const agenda = container.createDiv({ cls: `task-hub-agenda task-hub-agenda-${state.mode}` });
  agenda.style.setProperty("--task-hub-agenda-days", String(days.length));
  agenda.style.setProperty("--task-hub-agenda-hours", String(hourCount));
  agenda.style.setProperty("--task-hub-hour-height", `${HOUR_HEIGHT}px`);

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
  }

  const timeAxis = agenda.createDiv({ cls: "task-hub-agenda-time-axis" });
  for (let hour = startHour; hour <= endHour; hour += 1) {
    timeAxis.createDiv({ cls: "task-hub-agenda-time-label", text: formatHour(hour) });
  }

  const grid = agenda.createDiv({ cls: "task-hub-agenda-time-grid" });
  grid.style.setProperty("--task-hub-agenda-rows", String(hourCount));
  for (let index = 0; index < hourCount; index += 1) {
    grid.createDiv({ cls: "task-hub-agenda-hour-line" });
  }

  const columns = agenda.createDiv({ cls: "task-hub-agenda-columns" });
  for (const day of days) {
    const column = columns.createDiv({ cls: `task-hub-agenda-column ${day === today ? "is-today" : ""}` });
    bindTimedTaskCreation(column, day, startHour, state, handlers);
    bindCalendarTimedDropTarget(column, day, startHour, visibleItems, handlers, state);
    const dayTimedItems = timedItems.filter((item) => item.date === day);
    const itemLayouts = layoutTimedItems(dayTimedItems);
    for (const item of dayTimedItems) {
      renderTimedCalendarItem(column, item, startHour, handlers, state, itemLayouts.get(item.id));
    }
  }
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
  header.createSpan({ cls: "task-hub-calendar-weekday", text: shortWeekday(dayDate) });
  header.createSpan({ cls: "task-hub-calendar-day-number", text: String(dayDate.getDate()) });
  if (dayItems.length > 0) {
    header.createSpan({ cls: "task-hub-calendar-count", text: itemSummary(taskCount, eventCount, state.t) });
  }
}

function layoutTimedItems(items: CalendarItem[]): Map<string, TimedItemLayout> {
  const layouts = new Map<string, TimedItemLayout>();
  for (const [item, layout] of layoutTimedTaskPoints(items.filter((item) => item.kind === "task"))) {
    layouts.set(item.id, layout);
  }

  const sortedItems = [...items]
    .filter((item) => item.kind === "event")
    .sort((left, right) => (left.startMinutes ?? 0) - (right.startMinutes ?? 0) || itemEndMinutes(left) - itemEndMinutes(right) || left.title.localeCompare(right.title));
  let group: CalendarItem[] = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (group.length === 0) return;
    for (const [item, layout] of layoutOverlapGroup(group)) {
      layouts.set(item.id, layout);
    }
    group = [];
    groupEnd = -1;
  };

  for (const item of sortedItems) {
    const start = item.startMinutes ?? 0;
    if (group.length > 0 && start >= groupEnd) {
      flushGroup();
    }
    group.push(item);
    groupEnd = Math.max(groupEnd, itemEndMinutes(item));
  }
  flushGroup();

  return layouts;
}

function layoutTimedTaskPoints(items: CalendarItem[]): Map<CalendarItem, TimedItemLayout> {
  const layouts = new Map<CalendarItem, TimedItemLayout>();
  const laneEnds: number[] = [];
  const sortedItems = [...items].sort((left, right) => (left.startMinutes ?? 0) - (right.startMinutes ?? 0) || (right.createdSortKey ?? "").localeCompare(left.createdSortKey ?? "") || left.title.localeCompare(right.title));

  for (const item of sortedItems) {
    const top = taskPointTopPixels(item.startMinutes ?? 0);
    let stackIndex = laneEnds.findIndex((end) => end <= top);
    if (stackIndex === -1) {
      stackIndex = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[stackIndex] = top + TASK_TIME_POINT_HEIGHT + TASK_TIME_POINT_GAP;
    layouts.set(item, { columnIndex: 0, columnCount: 1, stackIndex });
  }
  return layouts;
}

function layoutOverlapGroup(items: CalendarItem[]): Map<CalendarItem, TimedItemLayout> {
  const layouts = new Map<CalendarItem, TimedItemLayout>();
  const columnEnds: number[] = [];

  for (const item of items) {
    const start = item.startMinutes ?? 0;
    let columnIndex = columnEnds.findIndex((end) => end <= start);
    if (columnIndex === -1) {
      columnIndex = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[columnIndex] = itemEndMinutes(item);
    layouts.set(item, { columnIndex, columnCount: 1 });
  }

  const columnCount = Math.max(1, columnEnds.length);
  for (const [item, layout] of layouts) {
    layouts.set(item, { ...layout, columnCount });
  }
  return layouts;
}

function itemEndMinutes(item: CalendarItem): number {
  const start = item.startMinutes ?? 0;
  return Math.max(item.endMinutes ?? start + DEFAULT_TIMED_TASK_DURATION_MINUTES, start + MIN_TIMED_ITEM_DURATION_MINUTES);
}

function renderTimedCalendarItem(
  container: HTMLElement,
  item: CalendarItem,
  startHour: number,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  layout?: TimedItemLayout
): void {
  const row = container.createDiv({ cls: calendarItemClass(item, "task-hub-calendar-timed-item") });
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) row.style.setProperty("--task-hub-item-color", item.color);
  const startMinutes = item.startMinutes ?? startHour * 60;
  const endMinutes = itemEndMinutes(item);
  const isTaskPoint = item.kind === "task";
  if (isTaskPoint) row.addClass("is-time-point");
  const baseTop = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
  const stackOffset = isTaskPoint ? (layout?.stackIndex ?? 0) * (TASK_TIME_POINT_HEIGHT + TASK_TIME_POINT_GAP) : 0;
  row.style.top = `${baseTop + stackOffset}px`;
  row.style.height = isTaskPoint ? `${TASK_TIME_POINT_HEIGHT}px` : `${Math.max(30, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 4)}px`;
  if (layout && layout.columnCount > 1) {
    row.style.left = `calc(${(100 * layout.columnIndex) / layout.columnCount}% + 6px)`;
    row.style.right = `calc(${100 - (100 * (layout.columnIndex + 1)) / layout.columnCount}% + 6px)`;
  }
  renderCalendarItemContent(row, item, handlers, state, isTaskPoint ? formatMinutes(startMinutes) : formatTimeRange(startMinutes, endMinutes));
  bindCalendarItemResize(row, container, item, startHour, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onTaskSelect(task);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
}

function bindCalendarItemResize(
  row: HTMLElement,
  column: HTMLElement,
  item: CalendarItem,
  startHour: number,
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  if (!canResizeCalendarItem(item, state) || item.startMinutes === undefined) return;

  const feedback = row.createDiv({ cls: "task-hub-calendar-resize-feedback" });
  for (const edge of ["start", "end"] as const) {
    let lastTarget: CalendarDropTarget | undefined;
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
      lastTarget = resizeDropTarget(column, event, item, startHour, edge);
      row.removeClass("is-resizing");
      row.addClass("is-resizing");
      updateResizeFeedback(feedback, row, lastTarget ? resizeDeltaMinutes(item, lastTarget, edge) : 0);

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const target = resizeDropTarget(column, moveEvent, item, startHour, edge);
        if (!target) return;
        lastTarget = target;
        updateResizeFeedback(feedback, row, resizeDeltaMinutes(item, target, edge));
      };
      const finishResize = () => {
        ownerDocument.removeEventListener("pointermove", onPointerMove);
        ownerDocument.removeEventListener("pointerup", onPointerUp);
        ownerDocument.removeEventListener("pointercancel", onPointerCancel);
        row.removeClass("is-resizing");
        clearResizeFeedback(feedback, row);
      };
      const onPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        const target = lastTarget ?? resizeDropTarget(column, upEvent, item, startHour, edge);
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
  edge: "start" | "end"
): CalendarDropTarget | undefined {
  if (item.startMinutes === undefined) return undefined;
  const currentStart = item.startMinutes;
  const currentEnd = Math.max(item.endMinutes ?? currentStart + DEFAULT_TIMED_TASK_DURATION_MINUTES, currentStart + MIN_TIMED_ITEM_DURATION_MINUTES);
  const draggedMinutes = minutesFromColumnEvent(column, event, startHour);
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
  return {
    dateKey,
    startMinutes: DEFAULT_MONTH_CREATION_START_MINUTES
  };
}

function bindTimedTaskCreation(
  element: HTMLElement,
  dateKey: string,
  startHour: number,
  state: CalendarViewState,
  handlers: CalendarViewHandlers
): void {
  if (!state.allowTaskCreation) return;
  element.addEventListener("click", (event) => {
    handlers.onDateCreateTask(timedCreationTarget(element, event, dateKey, startHour, state));
  });
}

function timedCreationTarget(
  element: HTMLElement,
  event: MouseEvent,
  dateKey: string,
  startHour: number,
  state: CalendarViewState
): CalendarDropTarget {
  return {
    dateKey,
    startMinutes: minutesFromColumnEvent(element, event, startHour),
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
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) row.style.setProperty("--task-hub-item-color", item.color);
  renderCalendarItemContent(row, item, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onTaskSelect(task);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
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
    const menu = new Menu();
    let itemCount = 0;
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
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("deleteCalendarItem"))
          .setIcon("trash")
          .onClick(() => {
            if (item.task) handlers.onTaskDelete?.(item.task);
          });
      });
    }
    if (item.event && canDeleteEvent(item, state)) {
      menu.addItem((menuItem) => {
        itemCount += 1;
        menuItem
          .setTitle(state.t("deleteCalendarItem"))
          .setIcon("trash")
          .onClick(() => {
            if (item.event) handlers.onEventDelete?.(item.event);
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
            if (task) handlers.onTaskSendToAppleReminders?.(task);
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

function bindCalendarItemDrag(element: HTMLElement, item: CalendarItem, state: CalendarViewState): void {
  if (!canDragCalendarItem(item, state)) return;

  element.draggable = true;
  element.setAttr("draggable", "true");
  element.setAttr("aria-grabbed", "false");
  element.addEventListener("pointerdown", (event) => {
    const grabOffset = dragGrabOffset(element, event, item);
    activeDragGrabOffsetMinutes = grabOffset?.minutes ?? 0;
    activeDragGrabOffsetXPixels = grabOffset?.xPixels ?? 0;
    activeDragGrabOffsetYPixels = grabOffset?.yPixels ?? 0;
  });
  element.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    activeDraggedCalendarItemId = item.id;
    const grabOffset = dragGrabOffset(element, event, item);
    activeDragGrabOffsetMinutes = grabOffset?.minutes ?? activeDragGrabOffsetMinutes;
    activeDragGrabOffsetXPixels = grabOffset?.xPixels ?? activeDragGrabOffsetXPixels;
    activeDragGrabOffsetYPixels = grabOffset?.yPixels ?? activeDragGrabOffsetYPixels;
    element.addClass("is-dragging");
    element.setAttr("aria-grabbed", "true");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(CALENDAR_ITEM_DRAG_MIME, item.id);
      if (item.kind === "task") {
        event.dataTransfer.setData(TASK_DRAG_MIME, item.id);
      }
    }
  });
  element.addEventListener("dragend", () => {
    element.removeClass("is-dragging");
    clearDragMoveFeedback();
    activeDraggedCalendarItemId = undefined;
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
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });
  element.addEventListener("dragleave", () => {
    element.removeClass("is-drop-hover");
  });
  element.addEventListener("drop", (event) => {
    const item = calendarItemFromDragEvent(event, visibleItems, state);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    element.removeClass("is-drop-hover");
    if (item.task) {
      handlers.onTaskReschedule(item.task, dateKey);
      return;
    }
    if (item.event) {
      handlers.onEventReschedule?.(item.event, dateKey);
    }
  });
}

function bindCalendarTimedDropTarget(
  element: HTMLElement,
  dateKey: string,
  startHour: number,
  visibleItems: CalendarItem[],
  handlers: CalendarViewHandlers,
  state: CalendarViewState
): void {
  element.addEventListener("dragover", (event) => {
    if (!isTaskHubDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    element.addClass("is-drop-hover");
    const item = calendarItemFromDragEvent(event, visibleItems, state);
    if (item) {
      const target = timedDropTarget(element, event, item, dateKey, startHour, state);
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
    const item = calendarItemFromDragEvent(event, visibleItems, state);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    element.removeClass("is-drop-hover");
    const target = timedDropTarget(element, event, item, dateKey, startHour, state);
    clearDragMoveFeedback();
    if (item.task) {
      handlers.onTaskReschedule(item.task, target);
      return;
    }
    if (item.event) {
      handlers.onEventReschedule?.(item.event, target);
    }
  });
}

function timedDropTarget(
  element: HTMLElement,
  event: DragEvent,
  item: CalendarItem,
  dateKey: string,
  startHour: number,
  state: CalendarViewState
): CalendarDropTarget {
  const startMinutes = adjustedDraggedStartMinutes(element, event, item, startHour);
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

function adjustedDraggedStartMinutes(element: HTMLElement, event: DragEvent, item: CalendarItem, startHour: number): number {
  const pointerMinutes = minutesFromColumnEvent(element, event, startHour);
  const offsetMinutes = item.startMinutes === undefined ? 0 : activeDragGrabOffsetMinutes;
  return snapDayQuarterHour(pointerMinutes - offsetMinutes);
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

function activeDraggedElement(): HTMLElement | undefined {
  return document.querySelector(".task-hub-calendar-timed-item.is-dragging") as HTMLElement | null ?? undefined;
}

function dragFeedbackElement(): HTMLElement | undefined {
  if (activeDragFeedbackElement) return activeDragFeedbackElement;
  const ownerDocument = activeDraggedElement()?.ownerDocument ?? document;
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
  feedback.style.left = `${Math.max(8, x)}px`;
  feedback.style.top = `${Math.max(8, y)}px`;
}

function validDurationMinutes(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return DEFAULT_TIMED_TASK_DURATION_MINUTES;
  return Math.max(MIN_TIMED_ITEM_DURATION_MINUTES, Math.min(24 * 60, Math.round(value)));
}

function itemDurationMinutes(item: CalendarItem, state: CalendarViewState): number {
  if (item.kind === "task") return MIN_TIMED_ITEM_DURATION_MINUTES;
  if (item.startMinutes !== undefined && item.endMinutes !== undefined) {
    return validDurationMinutes(item.endMinutes - item.startMinutes);
  }
  return validDurationMinutes(state.defaultTimedTaskDurationMinutes);
}

function minutesFromColumnEvent(element: HTMLElement, event: { clientY: number }, startHour: number): number {
  const rect = element.getBoundingClientRect();
  const offset = Math.max(0, event.clientY - rect.top);
  const rawMinutes = startHour * 60 + (offset / HOUR_HEIGHT) * 60;
  return snapDayQuarterHour(rawMinutes);
}

function dragGrabOffset(element: HTMLElement, event: { clientX: number; clientY: number }, item: CalendarItem): { minutes: number; xPixels: number; yPixels: number } | undefined {
  if (item.startMinutes === undefined) return { minutes: 0, xPixels: 0, yPixels: 0 };
  const rect = element.getBoundingClientRect();
  const offsetYPixels = event.clientY - rect.top;
  const offsetXPixels = event.clientX - rect.left;
  if (!Number.isFinite(offsetYPixels) || offsetYPixels < 0) return undefined;
  const durationMinutes = Math.max(MIN_TIMED_ITEM_DURATION_MINUTES, itemEndMinutes(item) - item.startMinutes);
  return {
    minutes: Math.max(0, Math.min(durationMinutes, Math.round((offsetYPixels / HOUR_HEIGHT) * 60 / 15) * 15)),
    xPixels: Number.isFinite(offsetXPixels) && offsetXPixels > 0 ? offsetXPixels : 0,
    yPixels: offsetYPixels
  };
}

function snapDayQuarterHour(value: number): number {
  return Math.max(0, Math.min(23 * 60 + 45, Math.round(value / 15) * 15));
}

function clampDayMinutes(value: number): number {
  return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

function calendarItemFromDragEvent(event: DragEvent, visibleItems: CalendarItem[], state: CalendarViewState): CalendarItem | undefined {
  const draggedId = activeDraggedCalendarItemId ?? event.dataTransfer?.getData(CALENDAR_ITEM_DRAG_MIME) ?? event.dataTransfer?.getData(TASK_DRAG_MIME);
  if (!draggedId) return undefined;
  return visibleItems.find((item) => item.id === draggedId && canDragCalendarItem(item, state));
}

function isTaskHubDrag(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes(CALENDAR_ITEM_DRAG_MIME) || types.includes(TASK_DRAG_MIME);
}

function canDragCalendarItem(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.kind === "event") {
    return item.event?.sourceId === "apple-calendar" && Boolean(state.allowAppleCalendarWriteback) && Boolean(item.event.id);
  }
  if (item.task?.source === "vault") return true;
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canResizeCalendarItem(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.allDay || item.startMinutes === undefined) return false;
  if (item.kind === "task") return false;
  if (item.kind === "event") {
    return item.event?.sourceId === "apple-calendar" && Boolean(state.allowAppleCalendarWriteback) && Boolean(item.event.id);
  }
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canDeleteTask(item: CalendarItem, state: CalendarViewState): boolean {
  if (item.task?.source === "vault") return true;
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canDeleteEvent(item: CalendarItem, state: CalendarViewState): boolean {
  return item.event?.sourceId === "apple-calendar" && Boolean(state.allowAppleCalendarWriteback) && Boolean(item.event.id);
}

function canSendTaskToAppleReminders(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(state.allowAppleReminderCreate && item.task?.source === "vault");
}

function taskPointTopPixels(startMinutes: number): number {
  return (startMinutes / 60) * HOUR_HEIGHT;
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
  return task.source === "vault" || (task.source === "apple-reminders" && state.allowAppleReminderWriteback);
}

function shortWeekday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function calendarTitle(date: Date, mode: CalendarViewMode, t: Translator, showLunarCalendar?: boolean): string {
  const locale = t("language") === "语言" ? "zh-CN" : "en-US";
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
