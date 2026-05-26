import { Menu } from "obsidian";
import { buildCalendarItems, calendarEventLayerId, getCalendarRange, type CalendarItem, type CalendarViewMode } from "../calendar/calendarModel";
import { toLocalDateKey } from "../calendar/dateBuckets";
import { formatLunarDayLabel, formatLunarMonthTitle } from "../calendar/lunarCalendar";
import type { TranslationKey, Translator } from "../i18n";
import type { AppleCalendarInfo, AppleReminderList, CalendarEvent, CalendarItemEditDraft, CalendarSource, CalendarSourceStatus, TaskItem, WeekStart } from "../types";

export type CalendarViewState = {
  mode: CalendarViewMode;
  focusDate: Date;
  weekStart: WeekStart;
  visibleSourceIds: Set<string>;
  includeCompletedTasks: boolean;
  allowAppleReminderWriteback: boolean;
  allowAppleReminderCreate?: boolean;
  allowAppleCalendarWriteback?: boolean;
  allowAppleCalendarReminderConversion?: boolean;
  allowTaskCreation: boolean;
  showLunarCalendar?: boolean;
  today?: Date;
  defaultTimedTaskDurationMinutes?: number;
  taskDurationOverrides?: Record<string, number>;
  taskColors?: Record<string, string>;
  appleReminderLists?: AppleReminderList[];
  appleCalendars?: AppleCalendarInfo[];
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
  onTaskUpdate?: (task: TaskItem, draft: Extract<CalendarItemEditDraft, { kind: "task" }>) => void;
  onTaskReschedule: (task: TaskItem, target: CalendarDropTarget) => void;
  onTaskDelete?: (task: TaskItem) => void;
  onTaskSendToAppleReminders?: (task: TaskItem) => void;
  onEventReschedule?: (event: CalendarEvent, target: CalendarDropTarget) => void;
  onEventUpdate?: (event: CalendarEvent, draft: Extract<CalendarItemEditDraft, { kind: "event" }>) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onEventSendToAppleReminders?: (event: CalendarEvent) => void;
  onTaskSendToAppleCalendar?: (task: TaskItem) => void;
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
let activeDetailsElement: HTMLElement | undefined;
let activeSelectedCalendarItemKey: string | undefined;
let activeCalendarItemElements = new Map<string, Set<HTMLElement>>();
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

export function renderCalendarView(
  container: HTMLElement,
  state: CalendarViewState,
  tasks: TaskItem[],
  events: CalendarEvent[],
  handlers: CalendarViewHandlers
): void {
  activeDetailsElement?.remove();
  activeDetailsElement = undefined;
  activeCalendarItemElements = new Map();
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
  const sortedItems = layoutTimedTaskPoints(items.filter((item) => item.kind === "task"))
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

function layoutTimedTaskPoints(items: CalendarItem[]): TimedLayoutCandidate[] {
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
    const overlapping = sortedItems.filter((candidate) => taskPointsOverlap(item, candidate));
    candidates.push({
      item,
      startMinutes,
      visualStart: startMinutes,
      visualEnd: visualMinutesForPixels(taskPointTopPixels(startMinutes) + TASK_TIME_POINT_HEIGHT),
      overlapIndex: overlapping.findIndex((candidate) => candidate.id === item.id),
      overlapCount: overlapping.length
    });
  }
  return candidates;
}

function taskCompletionRank(item: CalendarItem): number {
  return item.task?.completed ? 1 : 0;
}

function taskPointsOverlap(left: CalendarItem, right: CalendarItem): boolean {
  const leftTop = taskPointTopPixels(left.startMinutes ?? 0);
  const rightTop = taskPointTopPixels(right.startMinutes ?? 0);
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
    .filter((other) => other.item.kind === "task" && taskPointsOverlap(candidate.item, other.item))
    .map((other) => other.item);
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
  if (item.kind === "task" && isTaskPointHiddenByOverlap(layout)) return;
  const row = container.createDiv({ cls: calendarItemClass(item, "task-hub-calendar-timed-item") });
  registerCalendarItemElement(row, item);
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) row.style.setProperty("--task-hub-item-color", item.color);
  const startMinutes = item.startMinutes ?? startHour * 60;
  const endMinutes = itemEndMinutes(item);
  const isTaskPoint = item.kind === "task";
  if (isTaskPoint) row.addClass("is-time-point");
  const baseTop = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
  row.style.top = `${baseTop}px`;
  row.style.height = isTaskPoint ? `${TASK_TIME_POINT_HEIGHT}px` : `${Math.max(30, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 4)}px`;
  if (isTaskPoint && (layout?.overlapCount ?? 1) > 1) {
    row.addClass(layout?.isOverlapRepresentative ? "is-overlap-stack" : "is-overlap-hidden");
    row.style.zIndex = String(10 + (layout?.overlapCount ?? 1));
    row.setAttr("data-task-hub-overlap-count", String(layout?.overlapCount ?? 1));
  }
  if (layout && layout.columnCount > 1) {
    row.style.left = `calc(${(100 * layout.columnIndex) / layout.columnCount}% + 6px)`;
    row.style.right = `calc(${100 - (100 * (layout.columnIndex + 1)) / layout.columnCount}% + 6px)`;
  }
  renderCalendarItemContent(row, item, handlers, state, isTaskPoint ? undefined : formatTimeRange(startMinutes, endMinutes));
  if (isTaskPoint && layout?.isOverlapRepresentative && (layout.overlapCount ?? 1) > 1) {
    row.createSpan({ cls: "task-hub-calendar-overlap-count", text: `+${(layout.overlapCount ?? 1) - 1}` });
  }
  bindCalendarItemResize(row, container, item, startHour, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item);
      if (layout?.overlapItems && layout.overlapItems.length > 1) {
        renderTimedTaskOverlapPopover(row, layout.overlapItems, handlers, state);
        return;
      }
      renderCalendarDetailsPopover(row, item, handlers, state);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item);
      renderCalendarDetailsPopover(row, item, handlers, state);
    });
  }
}

function isTaskPointHiddenByOverlap(layout: TimedItemLayout | undefined): boolean {
  return Boolean(layout && (layout.overlapCount ?? 1) > 1 && !layout.isOverlapRepresentative);
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
        suppressNextTimedCreationClick = true;
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
    if (suppressNextTimedCreationClick) {
      suppressNextTimedCreationClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
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
  registerCalendarItemElement(row, item);
  bindCalendarItemDrag(row, item, state);
  bindCalendarItemContextMenu(row, item, state, handlers);
  if (item.color) row.style.setProperty("--task-hub-item-color", item.color);
  renderCalendarItemContent(row, item, handlers, state);
  const task = item.task;
  if (task) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item);
      renderCalendarDetailsPopover(row, item, handlers, state);
    });
  } else {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      selectCalendarItem(row, item);
      renderCalendarDetailsPopover(row, item, handlers, state);
    });
  }
}

function registerCalendarItemElement(element: HTMLElement, item: CalendarItem): void {
  const key = calendarItemSelectionKey(item);
  element.setAttr("data-task-hub-calendar-selection", key);
  const elements = activeCalendarItemElements.get(key) ?? new Set<HTMLElement>();
  elements.add(element);
  activeCalendarItemElements.set(key, elements);
  if (key === activeSelectedCalendarItemKey) {
    element.addClass("is-selected");
  }
}

function selectCalendarItem(element: HTMLElement, item: CalendarItem): void {
  activeSelectedCalendarItemKey = calendarItemSelectionKey(item);
  for (const elements of activeCalendarItemElements.values()) {
    for (const candidate of elements) {
      candidate.removeClass("is-selected");
    }
  }
  for (const selected of activeCalendarItemElements.get(activeSelectedCalendarItemKey) ?? [element]) {
    selected.addClass("is-selected");
  }
}

function calendarItemSelectionKey(item: CalendarItem): string {
  if (item.task) return `task:${item.task.id}`;
  if (item.event) return `event:${calendarEventLayerId(item.event)}:${item.event.id}`;
  return item.id;
}

function renderCalendarDetailsPopover(anchor: HTMLElement, item: CalendarItem, handlers: CalendarViewHandlers, state: CalendarViewState): void {
  activeDetailsElement?.remove();
  const ownerDocument = anchor.ownerDocument;
  const popover = ownerDocument.createElement("div");
  popover.addClass("task-hub-calendar-detail-popover");
  popover.addEventListener("click", (event) => event.stopPropagation());
  ownerDocument.body.appendChild(popover);
  activeDetailsElement = popover;
  if (item.color) popover.style.setProperty("--task-hub-item-color", item.color);
  positionDetailsPopover(popover, anchor);

  const closePopover = () => {
    ownerDocument.removeEventListener("click", closePopover);
    ownerDocument.removeEventListener("keydown", closeOnEscape);
    popover.remove();
    if (activeDetailsElement === popover) activeDetailsElement = undefined;
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") closePopover();
  };
  ownerDocument.addEventListener("click", closePopover);
  ownerDocument.addEventListener("keydown", closeOnEscape);

  const header = popover.createDiv({ cls: "task-hub-calendar-detail-header" });
  const title = header.createDiv({ cls: "task-hub-calendar-detail-title" });
  renderDetailSourceLogo(title, item);
  title.createSpan({ text: state.t(item.task ? "taskDetails" : "calendarDetails") });
  const headerControls = header.createDiv({ cls: "task-hub-calendar-detail-header-controls" });
  const headerSourceSelect = item.event?.sourceId === "apple-calendar"
    ? detailCompactSelect(headerControls, state.appleCalendars ?? [], item.event.calendarId)
    : item.task?.source === "apple-reminders"
      ? detailCompactSelect(headerControls, state.appleReminderLists ?? [], item.task.externalListId)
    : undefined;
  if (headerSourceSelect) header.addClass("has-calendar-select");
  const close = header.createEl("button", { cls: "task-hub-icon-button", text: "×" });
  close.setAttr("aria-label", state.t("cancel"));
  close.addEventListener("click", closePopover);
  bindDetailsPopoverDrag(popover, header, ownerDocument);

  if (item.task) {
    renderTaskDetailsPopover(popover, item, item.task, handlers, state, closePopover, item.task.source === "apple-reminders" ? headerSourceSelect : undefined);
    return;
  }
  if (item.event) {
    renderEventDetailsPopover(popover, item, item.event, handlers, state, closePopover, headerSourceSelect);
  }
}

function renderTimedTaskOverlapPopover(anchor: HTMLElement, items: CalendarItem[], handlers: CalendarViewHandlers, state: CalendarViewState): void {
  activeDetailsElement?.remove();
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
    if (item.color) row.style.setProperty("--task-hub-item-color", item.color);
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
      selectCalendarItem(anchor, item);
      renderCalendarDetailsPopover(anchor, item, handlers, state);
    });
  }
}

function renderDetailSourceLogo(container: HTMLElement, item: CalendarItem): void {
  const source = detailSourceKind(item);
  if (!source) return;
  const logo = container.createSpan({ cls: `task-hub-calendar-detail-logo is-${source}` });
  logo.setAttr("aria-hidden", "true");
  if (source === "apple") {
    logo.createSvg("svg", { attr: { viewBox: "0 0 24 24", focusable: "false" } })
      .createSvg("path", { attr: { d: "M16.2 2.2c.1 1.2-.4 2.4-1.2 3.3-.8.9-2.1 1.5-3.2 1.4-.1-1.1.4-2.3 1.1-3.1.9-1 2.3-1.6 3.3-1.6ZM20 17.4c-.4.9-.6 1.3-1.1 2.1-.7 1.1-1.8 2.5-3.1 2.5-1.1 0-1.4-.7-2.9-.7s-1.8.7-2.9.7c-1.3 0-2.3-1.3-3.1-2.4-2.1-3.2-2.4-7-.9-9 1-1.3 2.5-2.1 3.9-2.1 1.4 0 2.3.7 3.1.7.8 0 2-.8 3.4-.7 1.2 0 2.4.5 3.3 1.7-2.9 1.6-2.4 5.6.3 7.2Z" } });
    return;
  }
  logo.createSvg("svg", { attr: { viewBox: "0 0 24 24", focusable: "false" } })
    .createSvg("path", { attr: { d: "M12 2 4.8 6.1 3.5 16 12 22l8.5-6-1.3-9.9L12 2Zm0 2.8 4.7 2.7-1 7.2L12 17.4l-3.7-2.7-1-7.2L12 4.8Zm0 3.2-2.2 1.3.5 3.6L12 14l1.7-1.1.5-3.6L12 8Z" } });
}

function detailSourceKind(item: CalendarItem): "apple" | "obsidian" | undefined {
  if (item.task?.source === "vault") return "obsidian";
  if (item.task?.source === "apple-reminders") return "apple";
  if (item.event?.sourceId === "apple-calendar") return "apple";
  return undefined;
}

function positionDetailsPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const width = 320;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const left = Math.max(8, Math.min(rect.right + 8, viewportWidth - width - 8));
  const top = Math.max(8, Math.min(rect.top, viewportHeight - 420));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function bindDetailsPopoverDrag(popover: HTMLElement, handle: HTMLElement, ownerDocument: Document): void {
  handle.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, a")) return;
    event.preventDefault();
    event.stopPropagation();

    const startLeft = Number.parseFloat(popover.style.left || "0");
    const startTop = Number.parseFloat(popover.style.top || "0");
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    popover.addClass("is-dragging");

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const maxLeft = Math.max(8, (window.innerWidth || 1024) - popover.getBoundingClientRect().width - 8);
      const maxTop = Math.max(8, (window.innerHeight || 768) - popover.getBoundingClientRect().height - 8);
      const left = Math.max(8, Math.min(startLeft + moveEvent.clientX - startX, maxLeft));
      const top = Math.max(8, Math.min(startTop + moveEvent.clientY - startY, maxTop));
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
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
  closePopover: () => void,
  headerList?: HTMLSelectElement
): void {
  const editable = task.source === "vault" || (task.source === "apple-reminders" && state.allowAppleReminderWriteback);
  const form = popover.createDiv({ cls: "task-hub-calendar-detail-form" });
  const title = detailInput(form, state.t("taskCreationBody"), task.text);
  const date = detailInput(form, state.t("date"), task.dueDate ?? "", "date");
  const time = detailInput(form, state.t("startTime"), timeFromTask(task), "time");
  let notes: HTMLTextAreaElement | undefined;
  let tags: HTMLInputElement | undefined;
  let list: HTMLSelectElement | undefined;
  if (task.source === "vault") {
    tags = detailInput(form, state.t("tags"), task.tags.join(" ")) as HTMLInputElement;
  }
  if (task.source === "apple-reminders") {
    list = headerList ?? detailSelect(form, state.t("appleReminderList"), state.appleReminderLists ?? [], task.externalListId, true);
    notes = detailTextarea(form, state.t("notes"), task.contextPreview ?? "");
  }
  if (!editable) {
    for (const field of [title, date, time, tags, notes, list]) {
      if (field) field.disabled = true;
    }
  }
  const actions = popover.createDiv({ cls: "task-hub-calendar-detail-actions" });
  renderDetailDeleteButton(actions, state, canDeleteTask(item, state), () => {
    handlers.onTaskDelete?.(task);
    closePopover();
  });
  const save = actions.createEl("button", { cls: "mod-cta", text: state.t("save") });
  const updateSaveState = () => {
    save.disabled = !editable || !taskDraftChanged(task, title.value, date.value, time.value, tags?.value, list?.value, notes?.value);
  };
  for (const input of [title, date, time, tags, notes, list].filter(Boolean)) {
    input?.addEventListener("input", updateSaveState);
    input?.addEventListener("change", updateSaveState);
  }
  updateSaveState();
  save.addEventListener("click", () => {
    handlers.onTaskUpdate?.(task, {
      kind: "task",
      title: title.value,
      date: date.value,
      startTime: time.value,
      tags: tags ? tags.value.split(/\s+/).filter(Boolean) : undefined,
      reminderListId: list?.value,
      notes: notes?.value
    });
    closePopover();
  });
  const open = actions.createEl("button", { text: state.t("openSource") });
  open.addEventListener("click", () => {
    handlers.onTaskJump(task);
    closePopover();
  });
  if (!editable) {
    popover.createDiv({ cls: "task-hub-detail-note", text: state.t("externalTaskReadOnly") });
  }
}

function renderEventDetailsPopover(
  popover: HTMLElement,
  item: CalendarItem,
  event: CalendarEvent,
  handlers: CalendarViewHandlers,
  state: CalendarViewState,
  closePopover: () => void,
  headerCalendar?: HTMLSelectElement
): void {
  const editable = event.sourceId === "apple-calendar" && Boolean(state.allowAppleCalendarWriteback);
  const form = popover.createDiv({ cls: "task-hub-calendar-detail-form" });
  const title = detailInput(form, state.t("eventCreationPlaceholder"), event.title);
  const dateRow = form.createDiv({ cls: "task-hub-calendar-detail-date-row" });
  const date = detailInput(dateRow, state.t("date"), event.start.slice(0, 10), "date");
  const allDay = dateRow.createEl("label", { cls: "task-hub-calendar-detail-check" });
  const allDayCheckbox = allDay.createEl("input", { type: "checkbox" });
  allDayCheckbox.checked = event.allDay;
  allDay.createSpan({ text: state.t("allDay") });
  const timeRow = form.createDiv({ cls: "task-hub-calendar-detail-time-row" });
  const startField = detailInputField(timeRow, state.t("startTime"), event.allDay ? "" : timeFromDateTime(event.start), "time");
  const endField = detailInputField(timeRow, state.t("endTime"), event.allDay ? "" : timeFromDateTime(event.end), "time");
  const start = startField.input;
  const end = endField.input;
  const updateTimedFieldVisibility = () => {
    timeRow.toggleClass("is-hidden", allDayCheckbox.checked);
  };
  updateTimedFieldVisibility();
  const calendar = headerCalendar ?? detailSelect(form, state.t("localAppleCalendar"), state.appleCalendars ?? [], event.calendarId, true);
  const notes = detailTextarea(form, state.t("notes"), event.description ?? "");
  if (event.location) form.createDiv({ cls: "task-hub-calendar-detail-readonly-row", text: event.location });
  if (event.url) form.createDiv({ cls: "task-hub-calendar-detail-readonly-row is-muted", text: event.url });
  if (!editable) {
    for (const field of [title, date, start, end, calendar, notes, allDayCheckbox]) {
      field.disabled = true;
    }
  }
  const actions = popover.createDiv({ cls: "task-hub-calendar-detail-actions" });
  renderDetailDeleteButton(actions, state, canDeleteEvent(item, state), () => {
    handlers.onEventDelete?.(event);
    closePopover();
  });
  const save = actions.createEl("button", { cls: "mod-cta", text: state.t("save") });
  const updateSaveState = () => {
    save.disabled = !editable || !eventDraftChanged(event, title.value, date.value, start.value, end.value, allDayCheckbox.checked, calendar.value, notes.value);
  };
  for (const input of [title, date, start, end, calendar, notes, allDayCheckbox]) {
    input.addEventListener("input", updateSaveState);
    input.addEventListener("change", () => {
      updateTimedFieldVisibility();
      updateSaveState();
    });
  }
  updateSaveState();
  save.addEventListener("click", () => {
    handlers.onEventUpdate?.(event, {
      kind: "event",
      title: title.value,
      date: date.value,
      startTime: start.value,
      endTime: end.value,
      allDay: allDayCheckbox.checked,
      calendarId: calendar.value,
      notes: notes.value
    });
    closePopover();
  });
  if (event.url) {
    const open = actions.createEl("button", { text: state.t("openSource") });
    open.addEventListener("click", () => {
      window.open(event.url);
      closePopover();
    });
  }
  if (!editable) {
    popover.createDiv({ cls: "task-hub-detail-note", text: state.t("readOnly") });
  }
}

function renderDetailDeleteButton(actions: HTMLElement, state: CalendarViewState, canDelete: boolean, onDelete: () => void): void {
  if (!canDelete) return;
  const button = actions.createEl("button", { cls: "task-hub-calendar-detail-delete", text: state.t("deleteCalendarItem") });
  button.addEventListener("click", onDelete);
}

function detailInput(container: HTMLElement, label: string, value: string | undefined, type = "text"): HTMLInputElement {
  return detailInputField(container, label, value, type).input;
}

function detailInputField(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  type = "text"
): { field: HTMLElement; input: HTMLInputElement } {
  const field = container.createEl("label", { cls: "task-hub-calendar-detail-field" });
  field.createSpan({ text: label });
  const input = field.createEl("input", { type }) as HTMLInputElement;
  input.value = value ?? "";
  return { field, input };
}

function detailTextarea(container: HTMLElement, label: string, value: string | undefined): HTMLTextAreaElement {
  const field = container.createEl("label", { cls: "task-hub-calendar-detail-field" });
  field.createSpan({ text: label });
  const textarea = field.createEl("textarea") as HTMLTextAreaElement;
  textarea.value = value ?? "";
  return textarea;
}

function detailSelect(
  container: HTMLElement,
  label: string,
  options: Array<{ id: string; name: string }>,
  value: string | undefined,
  inline = false
): HTMLSelectElement {
  const field = container.createEl("label", {
    cls: `task-hub-calendar-detail-field ${inline ? "task-hub-calendar-detail-inline-row" : ""}`
  });
  field.createSpan({ text: label });
  const select = field.createEl("select") as HTMLSelectElement;
  for (const option of options) {
    select.createEl("option", { value: option.id, text: option.name });
  }
  if (value) select.value = value;
  return select;
}

function detailCompactSelect(
  container: HTMLElement,
  options: Array<{ id: string; name: string }>,
  value: string | undefined
): HTMLSelectElement {
  const select = container.createEl("select", { cls: "task-hub-calendar-detail-header-select" }) as HTMLSelectElement;
  for (const option of options) {
    select.createEl("option", { value: option.id, text: option.name });
  }
  if (value) select.value = value;
  return select;
}

function timeFromTask(task: TaskItem): string {
  return task.scheduledDate ? timeFromDateTime(task.scheduledDate) : "";
}

function timeFromDateTime(value: string | undefined): string {
  return value?.match(/T(\d{2}):(\d{2})/)?.slice(1, 3).join(":") ?? "";
}

function taskDraftChanged(task: TaskItem, title: string, date: string, time: string, tags: string | undefined, listId: string | undefined, notes: string | undefined): boolean {
  if (title.trim() !== task.text) return true;
  if (date !== (task.dueDate ?? "")) return true;
  if (time !== timeFromTask(task)) return true;
  if (task.source === "vault" && (tags ?? "").trim() !== task.tags.join(" ")) return true;
  if (task.source === "apple-reminders" && (listId ?? "") !== (task.externalListId ?? "")) return true;
  if (task.source === "apple-reminders" && (notes ?? "") !== (task.contextPreview ?? "")) return true;
  return false;
}

function eventDraftChanged(event: CalendarEvent, title: string, date: string, start: string, end: string, allDay: boolean, calendarId: string, notes: string): boolean {
  if (title.trim() !== event.title) return true;
  if (date !== event.start.slice(0, 10)) return true;
  if (allDay !== event.allDay) return true;
  if (!allDay && start !== timeFromDateTime(event.start)) return true;
  if (!allDay && end !== timeFromDateTime(event.end)) return true;
  if (event.sourceId === "apple-calendar" && calendarId !== (event.calendarId ?? "")) return true;
  if (event.sourceId === "apple-calendar" && notes !== (event.description ?? "")) return true;
  return false;
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
    selectCalendarItem(element, item);
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
            if (task) {
              markCalendarItemExternalSending(item);
              handlers.onTaskSendToAppleReminders?.(task);
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

function markCalendarItemExternalSending(item: CalendarItem): void {
  const key = calendarItemSelectionKey(item);
  for (const element of activeCalendarItemElements.get(key) ?? []) {
    element.addClass("is-external-sending");
  }
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
    return isWritableAppleCalendarEvent(item, state) && Boolean(state.allowAppleCalendarWriteback);
  }
  if (item.task?.source === "vault") return true;
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
  return item.task?.source === "apple-reminders" && state.allowAppleReminderWriteback && Boolean(item.task.externalId);
}

function canDeleteEvent(item: CalendarItem, state: CalendarViewState): boolean {
  return isWritableAppleCalendarEvent(item, state) && Boolean(state.allowAppleCalendarWriteback);
}

function canSendTaskToAppleReminders(item: CalendarItem, state: CalendarViewState): boolean {
  return Boolean(state.allowAppleReminderCreate && item.task?.source === "vault");
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

function taskPointTopPixels(startMinutes: number): number {
  return (startMinutes / 60) * HOUR_HEIGHT;
}

function visualMinutesForPixels(pixels: number): number {
  return (pixels / HOUR_HEIGHT) * 60;
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
