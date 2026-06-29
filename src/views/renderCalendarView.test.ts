jest.mock("obsidian", () => ({
  setIcon: jest.fn(),
  setTooltip: jest.fn(),
  Menu: class {
    items: Array<{ title: string; icon: string; disabled?: boolean; click?: () => void }> = [];
    shownAt: unknown;

    constructor() {
      mockMenus.push(this);
    }

    addItem(build: (item: { setTitle(title: string): unknown; setIcon(icon: string): unknown; setDisabled(disabled: boolean): unknown; onClick(click: () => void): unknown }) => void): void {
      const item = {
        title: "",
        icon: "",
        disabled: undefined as boolean | undefined,
        click: undefined as (() => void) | undefined,
        setTitle(title: string) {
          this.title = title;
          return this;
        },
        setIcon(icon: string) {
          this.icon = icon;
          return this;
        },
        setDisabled(disabled: boolean) {
          this.disabled = disabled;
          return this;
        },
        onClick(click: () => void) {
          this.click = click;
          return this;
        }
      };
      build(item);
      this.items.push(item);
    }

    showAtMouseEvent(event: unknown): void {
      this.shownAt = event;
    }
  }
}), { virtual: true });

import { renderCalendarView } from "./renderCalendarView";
import { setTooltip as mockSetTooltip } from "obsidian";
import type { CalendarEvent, CalendarSource, TaskItem } from "../types";

const mockMenus: Array<{ items: Array<{ title: string; icon: string; disabled?: boolean; click?: () => void }>; shownAt: unknown }> = [];

class FakeDocument {
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  body!: FakeElement;

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  removeEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(name: string, event: Partial<FakeEvent> = {}): FakeEvent {
    const fakeEvent: FakeEvent = {
      dataTransfer: event.dataTransfer ?? new FakeDataTransfer(),
      clientX: event.clientX ?? 0,
      clientY: event.clientY ?? 0,
      deltaY: event.deltaY ?? 0,
      metaKey: event.metaKey ?? false,
      ctrlKey: event.ctrlKey ?? false,
      key: event.key,
      isComposing: event.isComposing ?? false,
      keyCode: event.keyCode,
      pointerId: event.pointerId,
      target: event.target,
      preventDefault: event.preventDefault ?? jest.fn(),
      stopPropagation: event.stopPropagation ?? jest.fn()
    };
    for (const listener of this.listeners.get(name) ?? []) {
      listener(fakeEvent);
    }
    return fakeEvent;
  }

  clear(): void {
    this.listeners.clear();
    this.body.children = [];
  }

  createElement(): FakeElement {
    return new FakeElement(this as unknown as Document);
  }
}

const fakeDocument = new FakeDocument();
const fakeWindow = {
  innerWidth: 1200,
  innerHeight: 800,
  open: jest.fn(),
  requestAnimationFrame: undefined as ((callback: FrameRequestCallback) => number) | undefined,
  matchMedia: undefined as ((query: string) => MediaQueryList) | undefined,
  setTimeout: (callback: () => void, delay?: number) => globalThis.setTimeout(callback, delay)
};
let currentTestRoot: FakeElement | undefined;

class FakeElement {
  parent?: FakeElement;
  ownerDocument: Document;
  children: FakeElement[] = [];
  checked = false;
  disabled = false;
  draggable = false;
  open = false;
  text = "";
  type = "";
  value = "";
  focused = false;
  clientHeight = 0;
  scrollHeight = 0;
  scrollLeft = 0;
  scrollTop = 0;
  attributes = new Map<string, string>();
  classes = new Set<string>();
  style = new Proxy({
    setProperty: jest.fn(function(this: Record<string, unknown>, name: string, value: string) {
      this[name] = value;
    }),
    removeProperty: jest.fn(function(this: Record<string, unknown>, name: string) {
      delete this[name];
    })
  }, {
    set(target, property, value) {
      (target as Record<string, unknown>)[String(property)] = value;
      return true;
    },
    get(target, property) {
      return (target as Record<string, unknown>)[String(property)];
    }
  });
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  boundingRect: Partial<DOMRect> = {};

  constructor(ownerDocument: Document = fakeDocument as unknown as Document) {
    this.ownerDocument = ownerDocument;
  }

  get doc(): Document {
    return this.ownerDocument;
  }

  get win(): Window {
    return fakeWindow as unknown as Window;
  }

  setCssProps(props: Record<string, string>): void {
    for (const [name, value] of Object.entries(props)) {
      this.style.setProperty(name, value);
    }
  }

  setCssStyles(styles: Partial<CSSStyleDeclaration>): void {
    Object.assign(this.style, styles);
  }

  getCssPropertyValue(property: string): string {
    return String((this.style as unknown as Record<string, unknown>)[property] ?? "");
  }

  get classList(): { contains: (cls: string) => boolean } {
    return {
      contains: (cls: string) => this.classes.has(cls)
    };
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(value: string) {
    this.text = value;
  }

  empty(): void {
    this.children = [];
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  createEl(tag: string, options: { cls?: string; type?: string; text?: string; value?: string } = {}): FakeElement {
    const child = this.append(options);
    child.type = options.type ?? tag;
    child.value = options.value ?? "";
    return child;
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  setText(text: string): void {
    this.text = text;
  }

  createSvg(tag: string, options: { attr?: Record<string, string> } = {}): FakeElement {
    const child = this.append();
    child.type = tag;
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      child.attributes.set(name, value);
    }
    return child;
  }

  querySelector(selector: string): FakeElement | null {
    if (!selector.startsWith(".")) return null;
    const classes = selector.split(".").filter(Boolean);
    return collect(this).find((element) => classes.every((cls) => element.classes.has(cls))) ?? null;
  }

  addClass(cls: string): void {
    this.classes.add(cls);
  }

  removeClass(cls: string): void {
    this.classes.delete(cls);
  }

  toggleClass(cls: string, enabled: boolean): void {
    if (enabled) {
      this.classes.add(cls);
    } else {
      this.classes.delete(cls);
    }
  }

  hasClass(cls: string): boolean {
    return this.classes.has(cls);
  }

  setAttr(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = undefined;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  getBoundingClientRect(): DOMRect {
    return {
      top: this.boundingRect.top ?? 0,
      left: this.boundingRect.left ?? 0,
      bottom: this.boundingRect.bottom ?? 0,
      right: this.boundingRect.right ?? 0,
      width: this.boundingRect.width ?? 0,
      height: this.boundingRect.height ?? 0,
      x: this.boundingRect.x ?? 0,
      y: this.boundingRect.y ?? 0,
      toJSON: () => ({})
    } as DOMRect;
  }

  closest(selector: string): FakeElement | null {
    const tags = selector.split(",").map((tag) => tag.trim());
    if (tags.includes(this.type)) return this;
    return this.parent?.closest(selector) ?? null;
  }

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  focus(): void {
    this.focused = true;
  }

  click(): void {
    let stopped = false;
    const event = {
      dataTransfer: new FakeDataTransfer(),
      clientX: 0,
      clientY: 0,
      deltaY: 0,
      metaKey: false,
      ctrlKey: false,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(() => { stopped = true; })
    };
    for (const listener of this.listeners.get("click") ?? []) {
      listener(event);
    }
    if (!stopped) {
      this.parent?.click();
    }
  }

  dispatch(name: string, event: Partial<FakeEvent> = {}): FakeEvent {
    const fakeEvent: FakeEvent = {
      dataTransfer: event.dataTransfer ?? new FakeDataTransfer(),
      clientX: event.clientX ?? 0,
      clientY: event.clientY ?? 0,
      deltaY: event.deltaY ?? 0,
      metaKey: event.metaKey ?? false,
      ctrlKey: event.ctrlKey ?? false,
      key: event.key,
      isComposing: event.isComposing ?? false,
      keyCode: event.keyCode,
      pointerId: event.pointerId,
      target: event.target,
      preventDefault: event.preventDefault ?? jest.fn(),
      stopPropagation: event.stopPropagation ?? jest.fn()
    };
    for (const listener of this.listeners.get(name) ?? []) {
      listener(fakeEvent);
    }
    return fakeEvent;
  }

  add(option: FakeElement): void {
    this.appendChild(option);
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement(this.ownerDocument);
    child.parent = this;
    child.text = options.text ?? "";
    for (const cls of (options.cls ?? "").split(" ").filter(Boolean)) {
      child.classes.add(cls);
    }
    this.children.push(child);
    return child;
  }
}

fakeDocument.body = new FakeElement(fakeDocument as unknown as Document);

type FakeEvent = {
  dataTransfer: FakeDataTransfer;
  clientX: number;
  clientY: number;
  deltaY: number;
  metaKey: boolean;
  ctrlKey: boolean;
  key?: string;
  isComposing?: boolean;
  keyCode?: number;
  preventDefault(): void;
  stopPropagation(): void;
  pointerId?: number;
  target?: FakeElement;
};

class FakeDataTransfer {
  effectAllowed = "";
  dropEffect = "";
  hideData = false;
  hideTypes = false;
  private values = new Map<string, string>();

  setData(type: string, value: string): void {
    this.values.set(type, value);
  }

  getData(type: string): string {
    if (this.hideData) return "";
    return this.values.get(type) ?? "";
  }

  get types(): string[] {
    if (this.hideTypes) return [];
    return Array.from(this.values.keys());
  }

  setDragImage(): void {
    // The real browser uses this to replace the default drag ghost.
  }
}

const task: TaskItem = {
  id: "task-1",
  filePath: "Inbox.md",
  line: 0,
  rawLine: "- [ ] Task",
  text: "Task",
  completed: false,
  tags: [],
  dueDate: "2026-05-08",
  source: "vault"
};

const event: CalendarEvent = {
  id: "event-1",
  sourceId: "apple-calendar",
  title: "Event",
  start: "2026-05-08",
  allDay: true
};

const classEvent: CalendarEvent = {
  id: "event-class",
  sourceId: "apple-calendar",
  title: "Class Event",
  start: "2026-05-08",
  allDay: true,
  calendarId: "class",
  calendarName: "上课",
  calendarColor: "#FF8D28"
};

const source: CalendarSource = {
  id: "apple-calendar",
  name: "Apple Calendar",
  type: "apple-calendar",
  url: "local://apple-calendar",
  color: "#ef4444",
  enabled: true,
  refreshIntervalMinutes: 0,
  status: { state: "ok", lastSyncedAt: "2026-05-08T00:00:00.000Z", eventCount: 1 }
};

const classCalendarSource: CalendarSource = {
  id: "apple-calendar:class",
  name: "Apple 日历 / 上课",
  type: "apple-calendar",
  url: "local://apple-calendar/apple-calendar%3Aclass",
  color: "#FF8D28",
  enabled: true,
  refreshIntervalMinutes: 0,
  status: { state: "ok", lastSyncedAt: "2026-05-08T00:00:00.000Z", eventCount: 1 }
};

const remindersSource: CalendarSource = {
  id: "apple-reminders",
  name: "Apple Reminders",
  type: "apple-reminders",
  url: "local://apple-reminders",
  color: "#22c55e",
  enabled: true,
  refreshIntervalMinutes: 0,
  status: { state: "ok", lastSyncedAt: "2026-05-08T00:00:00.000Z", eventCount: 1 }
};

function collect(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collect)];
}

function findText(element: FakeElement, text: string): FakeElement | undefined {
  return collect(element).find((child) => child.text === text);
}

function activeCalendarDetailSurface(container: FakeElement): FakeElement | undefined {
  return collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"))
    ?? collect(container).find((element) => element.classes.has("task-hub-calendar-day-detail"));
}

function styleValue(element: FakeElement, property: string): string | undefined {
  return (element.style as unknown as Record<string, string | undefined>)[property];
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

describe("renderCalendarView", () => {
  beforeEach(() => {
    mockMenus.length = 0;
    (mockSetTooltip as jest.Mock).mockClear();
    fakeDocument.clear();
    currentTestRoot = undefined;
    (globalThis as unknown as { document: { querySelector(selector: string): FakeElement | null } }).document = {
      querySelector(selector: string): FakeElement | null {
        return currentTestRoot?.querySelector(selector) ?? null;
      }
    };
    fakeWindow.innerWidth = 1200;
    fakeWindow.innerHeight = 800;
    fakeWindow.open.mockClear();
    fakeWindow.requestAnimationFrame = undefined;
    fakeWindow.matchMedia = undefined;
    (globalThis as unknown as { window: typeof fakeWindow }).window = fakeWindow;
  });

  it("renders Chinese lunar month and day labels in month view when enabled", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-22T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        showLunarCalendar: true,
        sources: [],
        t: (key) => (key === "language" ? "语言" : key)
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-calendar-title") && element.text.includes("丙午年四月"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-calendar-lunar-day") && element.text === "初七")).toBe(true);
  });

  it("marks the calendar content stage with the requested mode transition direction", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        modeTransition: "left",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const stage = collect(container).find((element) => element.classes.has("task-hub-calendar-view-stage"));
    expect(stage?.classes.has("is-slide-left")).toBe(true);
    expect(stage?.classes.has("is-slide-right")).toBe(false);
  });

  it("restores a saved agenda scroll position when the parent shell was rerendered first", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarAgendaScrollPosition: { top: 340, left: 24 },
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const agenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    expect(agenda?.scrollTop).toBe(340);
    expect(agenda?.scrollLeft).toBe(24);
  });

  it("changes the day and week time scale after two command wheel steps only", () => {
    const dayContainer = new FakeElement();
    const onDayTimeScaleChange = jest.fn();

    renderCalendarView(
      dayContainer as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "hour",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn(),
        onTimeScaleChange: onDayTimeScaleChange
      }
    );

    const dayAgenda = collect(dayContainer).find((element) => element.classes.has("task-hub-agenda"));
    const normalWheel = dayAgenda!.dispatch("wheel", { deltaY: -100 });
    const firstCommandWheel = dayAgenda!.dispatch("wheel", { deltaY: -100, metaKey: true });
    const secondCommandWheel = dayAgenda!.dispatch("wheel", { deltaY: -100, metaKey: true });

    expect(onDayTimeScaleChange).toHaveBeenCalledTimes(1);
    expect(onDayTimeScaleChange).toHaveBeenCalledWith("half");
    expect(normalWheel.preventDefault).not.toHaveBeenCalled();
    expect(firstCommandWheel.preventDefault).toHaveBeenCalled();
    expect(secondCommandWheel.preventDefault).toHaveBeenCalled();

    const weekContainer = new FakeElement();
    const onWeekTimeScaleChange = jest.fn();

    renderCalendarView(
      weekContainer as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "hour",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn(),
        onTimeScaleChange: onWeekTimeScaleChange
      }
    );

    const weekAgenda = collect(weekContainer).find((element) => element.classes.has("task-hub-agenda"));
    weekAgenda!.dispatch("wheel", { deltaY: 100, metaKey: true });
    weekAgenda!.dispatch("wheel", { deltaY: 100, metaKey: true });

    expect(onWeekTimeScaleChange).toHaveBeenCalledWith("fit");
  });

  it("resets command wheel scale steps when the wheel direction changes", () => {
    const container = new FakeElement();
    const onTimeScaleChange = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "hour",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn(),
        onTimeScaleChange
      }
    );

    const agenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    agenda!.dispatch("wheel", { deltaY: -100, metaKey: true });
    agenda!.dispatch("wheel", { deltaY: 100, metaKey: true });
    agenda!.dispatch("wheel", { deltaY: 100, metaKey: true });

    expect(onTimeScaleChange).toHaveBeenCalledTimes(1);
    expect(onTimeScaleChange).toHaveBeenCalledWith("fit");
  });

  it("ignores command wheel in month view", () => {
    const container = new FakeElement();
    const onTimeScaleChange = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-22T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "hour",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn(),
        onTimeScaleChange
      }
    );

    container.dispatch("wheel", { deltaY: -100, metaKey: true });

    expect(onTimeScaleChange).not.toHaveBeenCalled();
  });

  it("uses discrete time scale heights and minor grid lines in day view", () => {
    const halfContainer = new FakeElement();

    renderCalendarView(
      halfContainer as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "half",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const halfAgenda = collect(halfContainer).find((element) => element.classes.has("task-hub-agenda"));
    const halfLines = collect(halfContainer).filter((element) => element.classes.has("task-hub-agenda-hour-line"));

    expect((halfAgenda!.style as unknown as Record<string, string>)["--task-hub-hour-height"]).toBe("84px");
    expect(halfLines).toHaveLength(32);
    expect(halfLines.filter((line) => line.classes.has("is-minor"))).toHaveLength(16);

    const quarterContainer = new FakeElement();
    renderCalendarView(
      quarterContainer as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "quarter",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const quarterAgenda = collect(quarterContainer).find((element) => element.classes.has("task-hub-agenda"));
    const quarterLines = collect(quarterContainer).filter((element) => element.classes.has("task-hub-agenda-hour-line"));

    expect((quarterAgenda!.style as unknown as Record<string, string>)["--task-hub-hour-height"]).toBe("112px");
    expect(quarterLines).toHaveLength(64);
    expect(quarterLines.filter((line) => line.classes.has("is-minor"))).toHaveLength(48);
  });

  it("renders a persistent details sidebar in day view and defaults it to the first visible item", () => {
    const container = new FakeElement();
    const timedTask = {
      ...task,
      id: "task-day-sidebar",
      text: "拍孕妇照",
      dueDate: "2026-05-08",
      scheduledDate: "2026-05-08T10:15"
    };
    const timedEvent = {
      ...event,
      id: "event-day-sidebar",
      title: "Converted from Apple Reminders",
      start: "2026-05-08T12:00",
      end: "2026-05-08T13:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        showLunarCalendar: true,
        sources: [source],
        t: (key) => key
      },
      [timedTask],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const sidebar = collect(container).find((element) => element.classes.has("task-hub-calendar-day-sidebar"));
    const selectedDetail = collect(container).find((element) => element.classes.has("task-hub-detail-title-input"));
    const miniMonth = collect(container).find((element) => element.classes.has("task-hub-calendar-mini-month"));
    const weekdayRow = collect(container).find((element) => element.classes.has("task-hub-calendar-mini-month-weekdays"));
    const lunarInline = collect(container).find((element) => element.classes.has("task-hub-calendar-lunar-inline"));
    const logo = collect(container).find((element) => element.classes.has("task-hub-detail-source-logo"));

    expect(sidebar).toBeDefined();
    expect(miniMonth).toBeDefined();
    expect(weekdayRow?.children[0]?.text.length).toBeGreaterThan(1);
    expect(lunarInline?.text).toBeTruthy();
    expect(selectedDetail?.value).toBe("拍孕妇照");
    expect(selectedDetail?.disabled).toBe(false);
    expect(logo?.classes.has("is-obsidian")).toBe(true);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBe(false);
  });

  it("updates the persistent day-view sidebar when selecting another day item", () => {
    const container = new FakeElement();
    const timedTask = {
      ...task,
      id: "task-day-sidebar-switch",
      text: "拍孕妇照",
      dueDate: "2026-05-08",
      scheduledDate: "2026-05-08T10:15"
    };
    const timedEvent = {
      ...event,
      id: "event-day-sidebar-switch",
      title: "Converted from Apple Reminders",
      start: "2026-05-08T12:00",
      end: "2026-05-08T13:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [timedTask],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const eventRow = collect(container).find((element) =>
      element.classes.has("task-hub-calendar-item") &&
      collect(element).some((child) => child.text === "Converted from Apple Reminders")
    );

    eventRow?.click();

    expect(collect(container).some((element) => element.value === "Converted from Apple Reminders")).toBe(true);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBe(false);
  });

  it("reuses the task detail editor in the day-view sidebar for vault tasks", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const timedTask = {
      ...task,
      id: "task-day-sidebar-edit",
      text: "论文",
      rawLine: "- [ ] 论文 📅 2026-06-28 #p/论文",
      dueDate: "2026-06-28",
      tags: ["#p/论文"],
      scheduledDate: undefined,
      source: "vault" as const
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-06-28T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [timedTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const detailSurface = activeCalendarDetailSurface(container);
    const title = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-detail-title-input"));
    const tagInput = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const logo = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-detail-source-logo"));
    const editor = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-detail-editor"));

    expect(title?.disabled).toBe(false);
    expect(tagInput).toBeDefined();
    expect(logo?.classes.has("is-obsidian")).toBe(true);

    title!.value = "论文终稿";
    title!.dispatch("input");
    tagInput!.value = "#写作";
    tagInput!.dispatch("keydown", { key: " " });
    editor?.dispatch("mouseleave");

    expect(onTaskUpdate).toHaveBeenCalledWith(timedTask, expect.objectContaining({
      title: "论文终稿",
      tags: ["#p/论文", "#写作"]
    }));
  });

  it("lets the day-view mini calendar switch the focused date directly", () => {
    const container = new FakeElement();
    const onFocusDateChange = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn(),
        onFocusDateChange
      }
    );

    const targetDay = collect(container).find((element) =>
      element.classes.has("task-hub-calendar-mini-month-day") &&
      !element.classes.has("is-outside-month") &&
      element.text === "12"
    );

    targetDay?.click();

    expect(onFocusDateChange).toHaveBeenCalled();
    expect(localDateKey(onFocusDateChange.mock.calls[0][0])).toBe("2026-05-12");
  });

  it("renders only the weeks needed for the day-view mini calendar month", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-06-29T12:00:00"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const miniMonthDays = collect(container).filter((element) => element.classes.has("task-hub-calendar-mini-month-day"));
    const julySixth = miniMonthDays.find((element) => element.text === "6" && element.classes.has("is-outside-month"));

    expect(miniMonthDays).toHaveLength(35);
    expect(julySixth).toBeUndefined();
  });

  it("renders a lightweight localized month title above the day-view mini calendar grid", () => {
    const container = new FakeElement();
    const translator = Object.assign((key: string) => key, { locale: "zh-CN" });

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-06-29T12:00:00"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: translator as unknown as ((key: never) => string) & { locale?: string }
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const monthTitle = collect(container).find((element) => element.classes.has("task-hub-calendar-mini-month-title"));

    expect(monthTitle?.text).toBe("六月");
  });

  it("shows hover counts and completion heat for mini calendar dates", () => {
    const container = new FakeElement();
    const completedTask = {
      ...task,
      id: "task-completed-mini-month",
      text: "Done",
      completed: true,
      completedDate: "2026-05-09",
      rawLine: "- [x] Done ✅ 2026-05-09"
    };
    const sameDayEvent = {
      ...event,
      id: "event-mini-month-stats",
      title: "Planning",
      start: "2026-05-08",
      allDay: true
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [task, completedTask],
      [sameDayEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const focusedDay = collect(container).find((element) =>
      element.classes.has("task-hub-calendar-mini-month-day") &&
      element.classes.has("is-selected") &&
      element.text === "8"
    );
    const completedDay = collect(container).find((element) =>
      element.classes.has("task-hub-calendar-mini-month-day") &&
      !element.classes.has("is-outside-month") &&
      element.text === "9"
    );
    const emptyDay = collect(container).find((element) =>
      element.classes.has("task-hub-calendar-mini-month-day") &&
      element.text === "13"
    );
    const ariaLabel = focusedDay?.attributes.get("aria-label") ?? "";
    const completedDayAriaLabel = completedDay?.attributes.get("aria-label") ?? "";

    expect(focusedDay?.classes.has("has-task")).toBe(true);
    expect(emptyDay?.classes.has("has-task")).toBe(false);
    expect(focusedDay?.classes.has("is-completion-1")).toBe(false);
    expect(completedDay?.classes.has("is-completion-1")).toBe(true);
    expect(focusedDay?.attributes.has("title")).toBe(false);
    expect(ariaLabel).toContain("2 tasks");
    expect(ariaLabel).toContain("0 completed");
    expect(ariaLabel).toContain("1 event");
    expect(completedDayAriaLabel).toContain("1 completed");
    expect(mockSetTooltip).toHaveBeenCalledWith(
      focusedDay,
      expect.stringContaining("2 tasks"),
      expect.objectContaining({ placement: "top" })
    );
  });

  it("fits the configured day range into the available pane height at the coarsest scale", () => {
    const container = new FakeElement();
    container.boundingRect.height = 640;

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "fit",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const agenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    const lines = collect(container).filter((element) => element.classes.has("task-hub-agenda-hour-line"));

    expect((agenda!.style as unknown as Record<string, string>)["--task-hub-hour-height"]).toBe("28px");
    expect(lines).toHaveLength(8);
  });

  it("marks the coarsest agenda scale and hides timed item time labels", () => {
    const container = new FakeElement();
    const timedEvent = {
      ...event,
      id: "timed-event",
      allDay: false,
      start: "2026-05-08T09:00:00",
      end: "2026-05-08T10:00:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "fit",
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const agenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const timeLabels = collect(item!).filter((element) => element.classes.has("task-hub-calendar-item-time"));
    const title = collect(item!).find((element) => element.classes.has("task-hub-calendar-item-title"));

    expect(agenda?.classes.has("is-scale-fit")).toBe(true);
    expect(timeLabels).toHaveLength(0);
    expect(title?.text).toBe("Event");
  });

  it("uses the configured visible hour range and auto-extends for out-of-range timed items", () => {
    const container = new FakeElement();
    const earlyTask = {
      ...task,
      id: "early",
      text: "Early",
      scheduledDate: "2026-05-08T05:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarTimeScale: "hour",
        calendarDayStartHour: 8,
        calendarDayEndHour: 12,
        sources: [],
        t: (key) => key
      },
      [earlyTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const labels = collect(container).filter((element) => element.classes.has("task-hub-agenda-time-label")).map((element) => element.text);
    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));

    expect(labels[0]).toBe("05:00");
    expect(labels.at(-1)).toBe("12:00");
    expect((row!.style as unknown as { top: string }).top).toBe("28px");
  });

  it("renders calendar tasks with checkboxes and without task/event kind labels", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [task],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.type === "checkbox")).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-calendar-item-kind"))).toBe(false);
    expect(elements.map((element) => element.text)).not.toContain("task");
    expect(elements.map((element) => element.text)).not.toContain("event");
  });

  it("allows completing a Dida calendar task from its checkbox when writeback is enabled", () => {
    const container = new FakeElement();
    const onTaskComplete = jest.fn();
    const didaTask: TaskItem = {
      ...task,
      id: "dida-task",
      filePath: "Dida/Inbox",
      rawLine: "Dida task",
      text: "Dida task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [didaTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete,
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-task"));
    const checkbox = item ? collect(item).find((element) => element.type === "checkbox") : undefined;
    checkbox?.click();

    expect(checkbox?.disabled).toBe(false);
    expect(onTaskComplete).toHaveBeenCalledWith(didaTask);
  });

  it("highlights the today button when the current calendar range contains today", () => {
    const cases = [
      { mode: "day" as const, focusDate: "2026-05-16T12:00:00Z" },
      { mode: "week" as const, focusDate: "2026-05-14T12:00:00Z" },
      { mode: "month" as const, focusDate: "2026-05-01T12:00:00Z" }
    ];

    for (const testCase of cases) {
      const container = new FakeElement();

      renderCalendarView(
        container as unknown as HTMLElement,
        {
          mode: testCase.mode,
          focusDate: new Date(testCase.focusDate),
          weekStart: "monday",
          visibleSourceIds: new Set(["vault"]),
          includeCompletedTasks: false,
          allowAppleReminderWriteback: false,
          allowAppleCalendarWriteback: false,
          allowTaskCreation: false,
          today: new Date("2026-05-16T09:00:00Z"),
          sources: [],
          t: (key) => key
        },
        [],
        [],
        {
          onLayerToggle: jest.fn(),
          onModeChange: jest.fn(),
          onMove: jest.fn(),
          onDateCreateTask: jest.fn(),
          onTaskComplete: jest.fn(),
          onTaskJump: jest.fn(),
          onTaskSelect: jest.fn(),
          onTaskReschedule: jest.fn(),
          onEventReschedule: jest.fn(),
          onToday: jest.fn()
        }
      );

      const todayButton = collect(container).find((element) => element.classes.has("task-hub-calendar-today-button"));
      expect(todayButton?.classes.has("is-current-range")).toBe(true);
    }
  });

  it("keeps the today button neutral when the current calendar range does not contain today", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-09-01T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        today: new Date("2026-05-16T09:00:00Z"),
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const todayButton = collect(container).find((element) => element.classes.has("task-hub-calendar-today-button"));
    expect(todayButton?.classes.has("is-current-range")).toBe(false);
  });

  it("renders Apple Calendar sub-calendars as independent layers", () => {
    const container = new FakeElement();
    const onLayerToggle = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:class"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [classCalendarSource],
        t: (key) => key
      },
      [],
      [classEvent],
      {
        onLayerToggle,
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.text.includes("Apple 日历 / 上课"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-calendar-item-title") && element.text === "Class Event")).toBe(true);
    expect(elements.find((element) => element.classes.has("task-hub-layer-count"))?.text).toBe("1");
  });

  it("renders multi-day month events as clipped daily cards", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-09-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:class"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [classCalendarSource],
        t: (key) => key
      },
      [],
      [
        {
          ...classEvent,
          id: "multi-day-class",
          title: "Multi-day class",
          start: "2026-09-17T09:00:00",
          end: "2026-09-19T18:00:00",
          allDay: false
        }
      ],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const elements = collect(container);
    const spans = elements.filter((element) => element.classes.has("task-hub-calendar-month-span"));
    const titles = elements.filter((element) => element.classes.has("task-hub-calendar-item-title") && element.text === "Multi-day class");
    const multiDayCards = elements.filter((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-multi-day"));
    const startCards = multiDayCards.filter((element) => element.classes.has("is-multi-day-start"));
    const endCards = multiDayCards.filter((element) => element.classes.has("is-multi-day-end"));

    expect(spans).toHaveLength(0);
    expect(titles).toHaveLength(3);
    expect(multiDayCards).toHaveLength(3);
    expect(startCards).toHaveLength(1);
    expect(endCards).toHaveLength(1);
  });

  it("marks completed calendar tasks for completed styling", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: true,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [{ ...task, completed: true }],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-completed"))).toBe(true);
  });

  it("uses Apple Reminders source color for calendar task items", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [{ ...task, source: "apple-reminders" }],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    expect(item?.style.setProperty).toHaveBeenCalledWith("--task-hub-item-color", "#22c55e");
  });

  it("uses Apple Reminder list colors for calendar task items", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        taskColors: { personal: "#ef4444" },
        sources: [remindersSource],
        t: (key) => key
      },
      [{ ...task, source: "apple-reminders", externalListId: "personal" }],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    expect(item?.style.setProperty).toHaveBeenCalledWith("--task-hub-item-color", "#ef4444");
  });

  it("creates a task for a month day when calendar task creation is enabled", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const day = collect(container).find((element) => element.classes.has("task-hub-calendar-day") && element.text === "");
    day?.click();

    expect(onDateCreateTask).toHaveBeenCalledWith("2026-05-01");
  });

  it("aligns month days to the configured week start without rendering previous month days", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const cells = collect(container).filter((element) => element.classes.has("task-hub-calendar-day") || element.classes.has("task-hub-calendar-day-placeholder"));
    expect(cells.slice(0, 4).every((element) => element.classes.has("task-hub-calendar-day-placeholder"))).toBe(true);
    expect(cells[4].classes.has("task-hub-calendar-day")).toBe(true);
    expect(collect(cells[4]).map((element) => element.text)).toContain("1");
  });

  it("renders all month day items inside a scrollable item area", () => {
    const container = new FakeElement();
    const manyTasks = Array.from({ length: 6 }, (_, index) => ({
      ...task,
      id: `task-${index}`,
      text: `Task ${index + 1}`,
      dueDate: "2026-05-08"
    }));

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      manyTasks,
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const itemArea = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day-items"))
      .find((element) => collect(element).filter((child) => child.classes.has("task-hub-calendar-item")).length === 6);
    expect(itemArea).toBeDefined();
    expect(collect(itemArea as FakeElement).filter((element) => element.classes.has("task-hub-calendar-item"))).toHaveLength(6);
    expect(collect(container).map((element) => element.text)).not.toContain("+2 more");
  });

  it("shows a live hidden-item count while scrolling overflowing month day items", () => {
    const container = new FakeElement();
    const manyTasks = Array.from({ length: 5 }, (_, index) => ({
      ...task,
      id: `hidden-month-${index}`,
      text: `Hidden month ${index + 1}`,
      dueDate: "2026-05-08"
    }));

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      manyTasks,
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const itemArea = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day-items"))
      .find((element) => collect(element).filter((child) => child.classes.has("task-hub-calendar-item")).length === 5)!;
    const itemRows = collect(itemArea).filter((element) => element.classes.has("task-hub-calendar-item"));
    itemArea.boundingRect = { top: 0, bottom: 100, height: 100 };
    itemArea.clientHeight = 100;
    itemArea.scrollHeight = 180;
    itemRows.forEach((row, index) => {
      row.boundingRect = { top: index * 36, bottom: index * 36 + 30, height: 30 };
    });
    itemArea.dispatch("scroll");

    const badge = collect(itemArea).find((element) => element.classes.has("task-hub-hidden-count"));
    expect(badge?.text).toBe("+2");
    expect(itemArea.classes.has("has-hidden-items")).toBe(true);

    itemRows[3].boundingRect = { top: 90, bottom: 120, height: 30 };
    itemRows[4].boundingRect = { top: 126, bottom: 156, height: 30 };
    itemArea.dispatch("scroll");

    expect(badge?.text).toBe("+1");

    itemRows[4].boundingRect = { top: 90, bottom: 120, height: 30 };
    itemArea.dispatch("scroll");

    expect(badge?.text).toBe("");
    expect(itemArea.classes.has("has-hidden-items")).toBe(false);
  });

  it("does not treat unmeasured month day item geometry as hidden items", () => {
    const container = new FakeElement();
    const manyTasks = Array.from({ length: 3 }, (_, index) => ({
      ...task,
      id: `unmeasured-month-${index}`,
      text: `Unmeasured month ${index + 1}`,
      dueDate: "2026-05-08"
    }));

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      manyTasks,
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const itemArea = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day-items"))
      .find((element) => collect(element).filter((child) => child.classes.has("task-hub-calendar-item")).length === 3)!;
    const badge = collect(itemArea).find((element) => element.classes.has("task-hub-hidden-count"));

    expect(badge?.text).toBe("");
    expect(itemArea.classes.has("has-hidden-items")).toBe(false);
  });

  it("does not create a task from a month day when calendar task creation is disabled", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const day = collect(container).find((element) => element.classes.has("task-hub-calendar-day") && element.text === "");
    day?.click();

    expect(onDateCreateTask).not.toHaveBeenCalled();
  });

  it("opens a read-only popover for existing calendar tasks without save or delete buttons", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();
    const onTaskSelect = jest.fn();
    const onTaskUpdate = jest.fn();
    const onTaskDelete = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect,
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onTaskDelete,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item?.click();

    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    expect(popover).toBeDefined();
    expect(item?.classes.has("is-selected")).toBe(true);
    expect(onTaskSelect).not.toHaveBeenCalled();
    expect(onDateCreateTask).not.toHaveBeenCalled();
    const titleInput = collect(popover as FakeElement).find((element) => element.type === "text");
    const save = collect(popover as FakeElement).find((element) => element.text === "save");
    const deleteButton = collect(popover as FakeElement).find((element) => element.text === "delete");
    const logo = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    expect(save).toBeUndefined();
    expect(deleteButton).toBeUndefined();
    expect(titleInput?.disabled).toBe(true);
    expect(logo?.classes.has("is-obsidian")).toBe(true);
    expect(onTaskUpdate).not.toHaveBeenCalled();
    expect(onTaskDelete).not.toHaveBeenCalled();
  });

  it("shows the Dida source logo in calendar task details", () => {
    const container = new FakeElement();
    const didaTask: TaskItem = {
      ...task,
      id: "dida-logo",
      filePath: "Dida/Inbox",
      rawLine: "Dida logo task",
      text: "Dida logo task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [didaTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const logo = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    expect(logo?.classes.has("is-dida")).toBe(true);
  });

  it("edits Dida recurrence from the calendar task popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const didaTask: TaskItem = {
      ...task,
      id: "dida-recurring",
      filePath: "Dida/Inbox",
      rawLine: "Dida recurring task",
      text: "Dida recurring task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1",
      recurrence: "RRULE:FREQ=WEEKLY",
      contextPreview: "Dida notes"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowTaskCreation: false,
        didaProjects: [{ id: "project-1", name: "Inbox" }],
        sources: [],
        t: (key) => key
      },
      [didaTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const toggle = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-detail-extra-toggle"));
    const recurrenceSelect = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-recurrence-select"));
    const notesInput = collect(popover as FakeElement).find((element) =>
      element.type === "textarea" && !element.classes.has("task-hub-calendar-detail-title-input")
    );

    expect(recurrenceSelect?.value).toBe("RRULE:FREQ=WEEKLY");
    toggle!.checked = true;
    toggle!.dispatch("change");
    recurrenceSelect!.value = "RRULE:FREQ=DAILY";
    recurrenceSelect!.dispatch("change");
    notesInput!.value = "Updated Dida notes";
    notesInput!.dispatch("input");
    notesInput!.dispatch("keydown", { key: "Enter" });

    expect(onTaskUpdate).toHaveBeenCalledWith(didaTask, expect.objectContaining({
      recurrence: "RRULE:FREQ=DAILY",
      notes: "Updated Dida notes"
    }));
  });

  it("renders calendar detail notes with menu actions instead of card clicks", () => {
    const container = new FakeElement();
    const onOpenTaskNote = jest.fn();
    const onDeleteTaskNote = jest.fn();
    const onOpenTaskNoteSource = jest.fn();
    const onOpenTaskNoteInThino = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        taskNotesEnabled: true,
        allowThinoNoteEdit: true,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/one.md",
            related: [],
            history: [],
            title: "Calendar note body",
            body: "Calendar note body\nSecond calendar line #tag",
            bodyStartLine: 10,
            tags: ["#tag"],
            createdAt: "2026-05-29T10:30:12"
          }
        ],
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete: jest.fn(),
        onOpenTaskNote,
        onDeleteTaskNote,
        onOpenTaskNoteSource,
        onOpenTaskNoteInThino,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const noteCard = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-card"));
    noteCard?.click();
    expect(onOpenTaskNote).not.toHaveBeenCalled();
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-title"))?.text).toBe("one");
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Calendar note body");
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Second calendar line");
    expect(collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-date"))?.text).toBe("2026-05-29");

    const menuButton = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-menu"));
    menuButton?.click();
    expect(mockMenus.at(-1)?.items.map((menuItem) => menuItem.title)).toEqual([
      "delete",
      "edit",
      "taskNoteEditSource",
      "taskNoteEditInThino"
    ]);
    mockMenus.at(-1)?.items[0].click?.();
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    mockMenus.at(-1)?.items[3].click?.();
    expect(onDeleteTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(onOpenTaskNoteSource).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(onOpenTaskNoteInThino).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("edits Apple Reminder recurrence and notes in calendar task popovers after edit details is checked", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const onTaskDelete = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      externalListId: "list-1",
      contextPreview: "Original notes",
      recurrence: "RRULE:FREQ=WEEKLY"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        appleReminderLists: [
          { id: "list-1", name: "默认提醒" },
          { id: "list-2", name: "工作" }
        ],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onTaskDelete,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const header = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-header"));
    const headerTitle = collect(header as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-title"));
    const headerTitleText = collect(headerTitle as FakeElement).find((element) => element.text === "taskDetails");
    const headerComplete = collect(headerTitle as FakeElement).find((element) => element.classes.has("task-hub-detail-complete-checkbox"));
    const headerLogo = collect(headerTitle as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    const extra = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-extra"));
    const toggle = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-detail-extra-toggle"));
    const bodyLabel = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-detail-label") && element.text === "taskCreationBody");
    const bodyRow = bodyLabel?.parent;
    const editDetailsLabel = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-detail-label") && element.text === "editDetails");
    const editDetailsRow = editDetailsLabel?.parent;
    const notesInput = collect(extra as FakeElement).find((element) => element.type === "textarea");
    const recurrenceSelect = collect(extra as FakeElement).find((element) => element.classes.has("task-hub-recurrence-select"));
    const formListRow = collect(popover as FakeElement).find((element) => element.text === "appleReminderList");
    const save = collect(popover as FakeElement).find((element) => element.text === "save");
    const deleteButton = collect(popover as FakeElement).find((element) => element.text === "delete");

    expect(header?.classes.has("has-calendar-select")).toBe(false);
    expect(headerTitleText).toBeDefined();
    expect(headerTitle?.children.map((child) => child.classes.has("task-hub-calendar-detail-title-check-cell") ? "check-cell" : child.text || (child.classes.has("task-hub-calendar-detail-logo") ? "logo" : ""))).toEqual(["check-cell", "taskDetails", "logo"]);
    expect(headerComplete?.parent?.classes.has("task-hub-calendar-detail-title-check-cell")).toBe(true);
    expect(collect(bodyRow as FakeElement).some((element) => element.classes.has("task-hub-detail-complete-checkbox"))).toBe(false);
    expect(toggle?.parent?.classes.has("task-hub-detail-icon-cell")).toBe(true);
    expect(editDetailsRow?.classes.has("task-hub-calendar-detail-toggle")).toBe(true);
    expect(formListRow).toBeUndefined();
    expect(save).toBeUndefined();
    expect(extra?.classes.has("is-hidden")).toBe(true);
    expect(notesInput?.value).toBe("Original notes");
    expect(recurrenceSelect?.value).toBe("RRULE:FREQ=WEEKLY");
    toggle!.checked = true;
    toggle!.dispatch("change");
    expect(extra?.classes.has("is-hidden")).toBe(false);
    recurrenceSelect!.value = "RRULE:FREQ=MONTHLY";
    recurrenceSelect!.dispatch("change");
    notesInput!.value = "Updated notes";
    notesInput!.dispatch("input");
    notesInput!.dispatch("keydown", { key: "Enter" });
    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({
      notes: "Updated notes",
      recurrence: "RRULE:FREQ=MONTHLY"
    }));
    expect(deleteButton).toBeUndefined();
    expect(onTaskDelete).not.toHaveBeenCalled();
  });

  it("edits Apple Reminder alert settings in the calendar task popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30",
      alertMinutesBefore: 15
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const time = collect(popover as FakeElement).find((element) => element.type === "time");
    const alertSelect = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-reminder-alert-select"));

    expect(time?.value).toBe("09:30");
    expect(collect(popover as FakeElement).find((element) => element.classes.has("task-hub-reminder-alert-toggle"))).toBeUndefined();
    expect(alertSelect?.value).toBe("15");
    expect(alertSelect?.disabled).toBe(false);
    alertSelect!.value = "30";
    alertSelect!.dispatch("change");
    alertSelect!.dispatch("keydown", { key: "Enter" });
    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({
      startTime: "09:30",
      alertMinutesBefore: 30
    }));
  });

  it("allows adding an Apple Reminder alert time from the calendar popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: undefined,
      alertMinutesBefore: undefined
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const time = collect(popover as FakeElement).find((element) => element.type === "time");
    const alertSelect = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-reminder-alert-select"));

    expect(time?.value).toBe("");
    expect(time?.disabled).toBe(false);
    expect(alertSelect?.disabled).toBe(false);
    expect(collect(popover as FakeElement).some((element) => element.text === "设置时间后可提醒")).toBe(false);
    alertSelect!.value = "0";
    alertSelect!.dispatch("change");
    expect(time?.value).toBe("09:00");
    alertSelect!.dispatch("keydown", { key: "Enter" });
    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({
      startTime: "09:00",
      alertMinutesBefore: 0
    }));
  });

  it("does not save calendar task time edits while moving within the time input", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const time = collect(popover as FakeElement).find((element) => element.type === "time");

    time!.value = "09:45";
    time!.dispatch("input");
    time!.dispatch("change");
    time!.dispatch("blur");

    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it("does not save calendar task detail edits when tabbing or clicking outside the popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const time = collect(popover as FakeElement).find((element) => element.type === "time");

    time!.value = "09:45";
    time!.dispatch("input");
    time!.dispatch("keydown", { key: "Tab" });
    fakeDocument.dispatch("click");

    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it("saves calendar task date and time edits with Enter without closing the popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const fields = collect(popover as FakeElement).filter((element) => ["text", "date", "time"].includes(element.type));
    const date = fields.find((element) => element.type === "date");
    const time = fields.find((element) => element.type === "time");

    date!.value = "2026-05-09";
    date!.dispatch("input");
    const dateEnter = date!.dispatch("keydown", { key: "Enter" });

    expect(dateEnter.preventDefault).toHaveBeenCalled();
    expect(time?.focused).toBe(false);
    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({
      date: "2026-05-09"
    }));
    expect(collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBeDefined();
  });

  it("saves calendar task title edits when pressing Enter in the body field", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const title = collect(popover as FakeElement).find((element) =>
      element.type === "textarea" &&
      element.classes.has("task-hub-calendar-detail-title-input") &&
      element.classes.has("task-hub-auto-grow-textarea")
    );

    title!.value = "Updated body";
    title!.dispatch("input");
    const enter = title!.dispatch("keydown", { key: "Enter" });

    expect(enter.preventDefault).toHaveBeenCalled();
    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({
      title: "Updated body"
    }));
  });

  it("does not save calendar task title edits when Enter is confirming IME composition", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskUpdate,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const title = collect(popover as FakeElement).find((element) =>
      element.type === "textarea" &&
      element.classes.has("task-hub-calendar-detail-title-input") &&
      element.classes.has("task-hub-auto-grow-textarea")
    );

    title!.value = "task";
    title!.dispatch("input");
    title!.dispatch("keydown", { key: "Enter", isComposing: true, keyCode: 229 });

    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it("renders the calendar task body as an auto-growing multiline field", () => {
    const container = new FakeElement();
    const longTask = {
      ...task,
      text: "去旧货市场找一下有没有侧柜，顺便确认尺寸和颜色，必要时补充更多说明"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [longTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const body = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-title-input"));

    expect(body?.type).toBe("textarea");
    expect(body?.classes.has("task-hub-auto-grow-textarea")).toBe(true);
    expect(body?.value).toBe(longTask.text);
    expect(body?.attributes.get("rows")).toBe("1");
  });

  it("opens a read-only popover for ICS events", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["ics-source"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [{ ...source, id: "ics-source", type: "ics" }],
        t: (key) => key
      },
      [],
      [{ ...event, id: "ics-event", sourceId: "ics-source", url: "https://example.com/event" }],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onEventUpdate: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item?.click();

    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const save = collect(popover as FakeElement).find((element) => element.text === "save");
    const titleInput = collect(popover as FakeElement).find((element) => element.type === "text");
    const deleteButton = collect(popover as FakeElement).find((element) => element.text === "delete");
    const allDayCheckbox = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-check"));
    const detailRows = collect(popover as FakeElement).filter((element) => element.classes.has("task-hub-calendar-detail-row"));
    const hiddenTimeRows = detailRows.filter((element) => element.classes.has("is-hidden"));
    expect(popover).toBeDefined();
    expect(allDayCheckbox).toBeDefined();
    expect(hiddenTimeRows).toHaveLength(2);
    expect(save).toBeUndefined();
    expect(titleInput?.disabled).toBe(true);
    expect(deleteButton).toBeUndefined();
    findText(popover as FakeElement, "openSource")?.click();
    expect(window.open).toHaveBeenCalledWith("https://example.com/event");
    expect(onDateCreateTask).not.toHaveBeenCalled();
  });

  it("lays out event date with all-day and start/end times on compact rows", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [{ ...event, start: "2026-05-08T09:00", end: "2026-05-08T10:00", allDay: false }],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();

    const detailSurface = activeCalendarDetailSurface(container);
    const detailRows = collect(detailSurface as FakeElement).filter((element) => element.classes.has("task-hub-calendar-detail-row"));
    const labels = detailRows
      .map((row) => collect(row).find((element) => element.classes.has("task-hub-detail-label"))?.text)
      .filter(Boolean);

    expect(labels).toEqual(expect.arrayContaining(["date", "allDay", "startTime", "endTime"]));
    expect(collect(detailSurface as FakeElement).some((element) => element.classes.has("task-hub-calendar-detail-check"))).toBe(true);
    expect(detailRows.filter((row) => collect(row).some((element) => element.type === "time"))).toHaveLength(2);
  });

  it("shows zoned Apple Calendar event times in local time in the details editor", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-06-11T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [{
        ...event,
        start: "2026-06-11T11:30:00.000Z",
        end: "2026-06-11T12:30:00.000Z",
        allDay: false
      }],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();

    const detailSurface = activeCalendarDetailSurface(container);
    const [start, end] = collect(detailSurface as FakeElement).filter((element) => element.type === "time");
    const date = collect(detailSurface as FakeElement).find((element) => element.type === "date");
    const localStart = new Date("2026-06-11T11:30:00.000Z");
    const localEnd = new Date("2026-06-11T12:30:00.000Z");

    expect(date?.value).toBe(localDateKey(localStart));
    expect(start?.value).toBe(localTimeValue(localStart));
    expect(end?.value).toBe(localTimeValue(localEnd));
  });

  it("allows dragging the calendar detail popover by its header", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();

    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const header = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-header"));
    header?.dispatch("pointerdown", { clientX: 320, clientY: 160, pointerId: 7 });

    expect(popover?.classes.has("is-dragging")).toBe(true);

    fakeDocument.dispatch("pointermove", { clientX: 360, clientY: 190, pointerId: 7 });
    fakeDocument.dispatch("pointerup", { clientX: 360, clientY: 190, pointerId: 7 });

    expect((popover?.style as unknown as Record<string, string>).left).toBe("48px");
    expect((popover?.style as unknown as Record<string, string>).top).toBe("38px");
    expect(popover?.classes.has("is-dragging")).toBe(false);
  });

  it("closes the detail popover when clicking outside it", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBe(true);

    fakeDocument.dispatch("click");

    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBe(false);
  });

  it("creates a task from a week all-day slot when calendar task creation is enabled", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const slot = collect(container).find((element) => element.classes.has("task-hub-agenda-all-day-slot"));
    slot?.click();

    expect(onDateCreateTask).toHaveBeenCalledWith("2026-05-04");
  });

  it("renders all week all-day items so the slot can scroll", () => {
    const container = new FakeElement();
    const manyTasks = Array.from({ length: 5 }, (_, index) => ({
      ...task,
      id: `week-all-day-${index}`,
      text: `All-day task ${index + 1}`,
      dueDate: "2026-05-08"
    }));

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      manyTasks,
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const fridaySlot = collect(container)
      .filter((element) => element.classes.has("task-hub-agenda-all-day-slot"))
      .find((element) => collect(element).filter((child) => child.classes.has("task-hub-calendar-item")).length === 5);
    expect(fridaySlot).toBeDefined();
    expect(collect(container).map((element) => element.text)).not.toContain("+2 more");
  });

  it("shows a live hidden-item count while scrolling overflowing week all-day items", () => {
    const container = new FakeElement();
    const manyTasks = Array.from({ length: 4 }, (_, index) => ({
      ...task,
      id: `hidden-week-${index}`,
      text: `Hidden week ${index + 1}`,
      dueDate: "2026-05-08"
    }));

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      manyTasks,
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const fridaySlot = collect(container)
      .filter((element) => element.classes.has("task-hub-agenda-all-day-slot"))
      .find((element) => collect(element).filter((child) => child.classes.has("task-hub-calendar-item")).length === 4)!;
    const itemRows = collect(fridaySlot).filter((element) => element.classes.has("task-hub-calendar-item"));
    fridaySlot.boundingRect = { top: 0, bottom: 92, height: 92 };
    fridaySlot.clientHeight = 92;
    fridaySlot.scrollHeight = 152;
    itemRows.forEach((row, index) => {
      row.boundingRect = { top: index * 38, bottom: index * 38 + 32, height: 32 };
    });
    fridaySlot.dispatch("scroll");

    const badge = collect(fridaySlot).find((element) => element.classes.has("task-hub-hidden-count"));
    expect(badge?.text).toBe("+1");
    expect(fridaySlot.classes.has("has-hidden-items")).toBe(true);

    itemRows[3].boundingRect = { top: 76, bottom: 108, height: 32 };
    fridaySlot.dispatch("scroll");

    expect(badge?.text).toBe("");
    expect(fridaySlot.classes.has("has-hidden-items")).toBe(false);
  });

  it("creates a task from a week day header when calendar task creation is enabled", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const header = collect(container).find((element) => element.classes.has("task-hub-agenda-day-header"));
    header?.click();

    expect(onDateCreateTask).toHaveBeenCalledWith("2026-05-04");
  });

  it("creates a timed task from a day time-grid click using the clicked time", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        defaultTimedTaskDurationMinutes: 60,
        sources: [],
        t: (key) => key
      },
      [],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    column?.dispatch("click", { clientY: 196 });

    expect(onDateCreateTask).toHaveBeenCalledWith({
      dateKey: "2026-05-08",
      startMinutes: 570,
      durationMinutes: 60
    });
  });

  it("does not create a task when clicking an existing timed calendar event", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: true,
        sources: [source],
        t: (key) => key
      },
      [],
      [{ ...event, start: "2026-05-08T09:00", end: "2026-05-08T10:00", allDay: false }],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    item?.click();

    expect(onDateCreateTask).not.toHaveBeenCalled();
    const detailSurface = activeCalendarDetailSurface(container);
    const headerTitle = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-title"));
    const logo = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    expect(detailSurface?.classes.has("task-hub-calendar-day-event-detail")).toBe(true);
    expect(headerTitle?.classes.has("is-event")).toBe(true);
    expect(headerTitle?.classes.has("has-complete-checkbox")).toBe(false);
    expect(collect(headerTitle as FakeElement).find((element) => element.text === "calendarDetails")).toBeDefined();
    expect(logo?.classes.has("is-apple")).toBe(true);
  });

  it("edits Apple Calendar event recurrence and notes after edit details is checked", () => {
    const container = new FakeElement();
    const onEventUpdate = jest.fn();
    const onEventDelete = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      description: "Original event notes",
      location: "Room 516",
      calendarId: "calendar-1",
      calendarName: "提醒"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        appleCalendars: [{ id: "calendar-1", name: "提醒", writable: true }],
        sources: [{
          ...source,
          id: "apple-calendar:calendar-1",
          name: "Apple 日历 / 提醒"
        }],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate,
        onEventDelete,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const detailSurface = activeCalendarDetailSurface(container);
    const extra = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-extra"));
    const toggle = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-detail-extra-toggle"));
    const notesInput = collect(extra as FakeElement).find((element) => element.type === "textarea");
    const locationLabel = collect(extra as FakeElement).find((element) => element.classes.has("task-hub-detail-label") && element.text === "location");
    const locationInput = collect(locationLabel?.parent as FakeElement).find((element) => element.type === "text");
    const recurrenceSelect = collect(extra as FakeElement).find((element) => element.classes.has("task-hub-recurrence-select"));
    const formCalendarLabel = collect(detailSurface as FakeElement).find((element) => element.classes.has("task-hub-detail-label") && element.text === "localAppleCalendar");
    const formCalendarRow = formCalendarLabel?.parent;
    const save = collect(detailSurface as FakeElement).find((element) => element.text === "save");
    const deleteButton = collect(detailSurface as FakeElement).find((element) => element.text === "delete");
    const calendarSelect = collect(formCalendarRow as FakeElement).find((element) => element.type === "select");

    const recurrenceScope = collect(extra as FakeElement).find((element) => element.type === "select" && element.value === "this");
    expect(extra?.classes.has("is-hidden")).toBe(true);
    expect(collect(extra as FakeElement).find((element) => element.text === "recurrenceApplyTo")).toBeDefined();
    expect(locationInput?.value).toBe("Room 516");
    expect(notesInput?.value).toBe("Original event notes");
    expect(recurrenceSelect?.value).toBe("");
    expect(formCalendarRow?.classes.has("task-hub-calendar-detail-row")).toBe(true);
    expect(formCalendarRow?.classes.has("task-hub-calendar-detail-inline-row")).toBe(false);
    expect(formCalendarLabel?.parent).toBe(formCalendarRow);
    expect(calendarSelect?.parent?.classes.has("task-hub-detail-control")).toBe(true);
    toggle!.checked = true;
    toggle!.dispatch("change");
    expect(extra?.classes.has("is-hidden")).toBe(false);
    expect(calendarSelect?.value).toBe("calendar-1");
    expect(calendarSelect?.disabled).toBe(false);
    expect(formCalendarRow).toBeDefined();
    expect(save).toBeUndefined();
    recurrenceSelect!.value = "RRULE:FREQ=MONTHLY";
    recurrenceSelect!.dispatch("change");
    recurrenceScope!.value = "future";
    recurrenceScope!.dispatch("change");
    locationInput!.value = "Room 518";
    locationInput!.dispatch("input");
    notesInput!.value = "Updated event notes";
    notesInput!.dispatch("input");
    notesInput!.dispatch("keydown", { key: "Enter" });
    expect(onEventUpdate).toHaveBeenCalledWith(timedEvent, expect.objectContaining({
      notes: "Updated event notes",
      location: "Room 518",
      recurrence: "RRULE:FREQ=MONTHLY",
      recurrenceScope: "future",
      calendarId: "calendar-1"
    }));
    expect(deleteButton).toBeUndefined();
    expect(onEventDelete).not.toHaveBeenCalled();
  });

  it("does not save Apple Calendar event time edits when tabbing from start to end time", () => {
    const container = new FakeElement();
    const onEventUpdate = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      calendarId: "calendar-1",
      calendarName: "提醒"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        appleCalendars: [{ id: "calendar-1", name: "提醒", writable: true }],
        sources: [{
          ...source,
          id: "apple-calendar:calendar-1",
          name: "Apple 日历 / 提醒"
        }],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const detailSurface = activeCalendarDetailSurface(container);
    const [start, end] = collect(detailSurface as FakeElement).filter((element) => element.type === "time");

    start.value = "09:30";
    start.dispatch("input");
    start.dispatch("change");
    start.dispatch("blur");
    start.dispatch("keydown", { key: "Tab" });
    end.focus();

    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(activeCalendarDetailSurface(container)).toBeDefined();
  });

  it("keeps the Apple Calendar event detail popover open across the refresh after Enter save", () => {
    const container = new FakeElement();
    const onEventUpdate = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      calendarId: "calendar-1",
      calendarName: "提醒"
    };
    const render = (events: CalendarEvent[]) => renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        appleCalendars: [{ id: "calendar-1", name: "提醒", writable: true }],
        sources: [{
          ...source,
          id: "apple-calendar:calendar-1",
          name: "Apple 日历 / 提醒"
        }],
        t: (key) => key
      },
      [],
      events,
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate,
        onToday: jest.fn()
      }
    );

    render([timedEvent]);
    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const detailSurface = activeCalendarDetailSurface(container);
    const start = collect(detailSurface as FakeElement).find((element) => element.type === "time");

    start!.value = "09:30";
    start!.dispatch("input");
    start!.dispatch("keydown", { key: "Enter" });
    render([{ ...timedEvent, start: "2026-05-08T09:30", end: "2026-05-08T10:30" }]);

    expect(onEventUpdate).toHaveBeenCalledWith(timedEvent, expect.objectContaining({
      startTime: "09:30"
    }));
    expect(activeCalendarDetailSurface(container)).toBeDefined();
  });

  it("submits five-minute Apple Calendar event time edits from the detail popover", () => {
    const container = new FakeElement();
    const onEventUpdate = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      calendarId: "calendar-1",
      calendarName: "提醒"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        appleCalendars: [{ id: "calendar-1", name: "提醒", writable: true }],
        sources: [{
          ...source,
          id: "apple-calendar:calendar-1",
          name: "Apple 日历 / 提醒"
        }],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventUpdate,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const detailSurface = activeCalendarDetailSurface(container);
    const [start, end] = collect(detailSurface as FakeElement).filter((element) => element.type === "time");

    start!.value = "10:05";
    end!.value = "11:10";
    start!.dispatch("input");
    end!.dispatch("input");
    end!.dispatch("keydown", { key: "Enter" });

    expect(onEventUpdate).toHaveBeenCalledWith(timedEvent, expect.objectContaining({
      startTime: "10:05",
      endTime: "11:10"
    }));
  });

  it("makes vault calendar tasks draggable", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));

    expect(item?.draggable).toBe(true);
  });

  it("reschedules a dragged vault task when dropped on a month day", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(onTaskReschedule).toHaveBeenCalledWith(task, "2026-05-12");
  });

  it("renders unscheduled tasks in a side panel and schedules one by dropping it on a month day", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const unscheduledTask = { ...task, id: "task-unscheduled", dueDate: undefined, rawLine: "- [ ] Unscheduled", text: "Unscheduled" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        unscheduledPanelOpen: true,
        unscheduledTasks: [unscheduledTask],
        selectedTaskIds: new Set(["task-unscheduled"]),
        sources: [],
        t: (key) => key
      },
      [task, unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const panel = collect(container).find((element) => element.classes.has("task-hub-unscheduled-panel"));
    const host = collect(container).find((element) => element.classes.has("task-hub-calendar-with-sidebar"));
    const row = collect(container).find((element) => element.classes.has("task-hub-unscheduled-task"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    row?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(panel).toBeDefined();
    expect(host?.classes.has("is-unscheduled-open")).toBe(true);
    expect(row?.draggable).toBe(true);
    expect(onTaskReschedule).toHaveBeenCalledWith(unscheduledTask, "2026-05-12");
  });

  it("mounts the unscheduled side panel inside the right sidebar host in week view", () => {
    const container = new FakeElement();
    const unscheduledTask = { ...task, id: "task-unscheduled-week", dueDate: undefined, rawLine: "- [ ] Week", text: "Week" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        unscheduledPanelOpen: true,
        unscheduledTasks: [unscheduledTask],
        sources: [],
        t: (key) => key
      },
      [unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const panel = collect(container).find((element) => element.classes.has("task-hub-unscheduled-panel"));
    const host = collect(container).find((element) => element.classes.has("task-hub-calendar-with-sidebar"));
    const stage = collect(container).find((element) => element.classes.has("task-hub-calendar-view-stage"));

    expect(host?.classes.has("is-unscheduled-open")).toBe(true);
    expect(panel?.parent).toBe(host);
    expect(panel?.parent).not.toBe(stage);
  });

  it("keeps the unscheduled side panel mounted while its close animation runs", () => {
    const container = new FakeElement();
    const unscheduledTask = { ...task, id: "task-unscheduled-closing", dueDate: undefined, rawLine: "- [ ] Unscheduled", text: "Unscheduled" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        unscheduledPanelOpen: false,
        unscheduledPanelClosing: true,
        unscheduledTasks: [unscheduledTask],
        sources: [],
        t: (key) => key
      },
      [task, unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const panel = collect(container).find((element) => element.classes.has("task-hub-unscheduled-panel"));
    const host = collect(container).find((element) => element.classes.has("task-hub-calendar-with-sidebar"));

    expect(panel).toBeDefined();
    expect(host?.classes.has("is-unscheduled-closing")).toBe(true);
    expect(panel?.classes.has("is-closing")).toBe(true);
  });

  it("completes an unscheduled side-panel task from its checkbox", () => {
    const container = new FakeElement();
    const onTaskComplete = jest.fn();
    const onTaskSelectionChange = jest.fn();
    const unscheduledTask = { ...task, id: "task-unscheduled-complete", dueDate: undefined, rawLine: "- [ ] Complete me", text: "Complete me" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        unscheduledPanelOpen: true,
        unscheduledTasks: [unscheduledTask],
        sources: [],
        t: (key) => key
      },
      [unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete,
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange,
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-unscheduled-task"));
    const checkbox = row ? collect(row).find((element) => element.type === "checkbox") : undefined;
    checkbox?.click();

    expect(onTaskComplete).toHaveBeenCalledWith(unscheduledTask);
    expect(onTaskSelectionChange).not.toHaveBeenCalled();
    expect(row?.classes.has("is-completing")).toBe(true);
  });

  it("keeps completed unscheduled side-panel tasks static after rerender", () => {
    const container = new FakeElement();
    const completedTask = { ...task, id: "task-unscheduled-completed", completed: true, dueDate: undefined, rawLine: "- [x] Done", text: "Done" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: true,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        unscheduledPanelOpen: true,
        unscheduledTasks: [completedTask],
        sources: [],
        t: (key) => key
      },
      [completedTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const host = collect(container).find((element) => element.classes.has("task-hub-calendar-with-sidebar"));
    const panel = collect(container).find((element) => element.classes.has("task-hub-unscheduled-panel"));
    const row = collect(container).find((element) => element.classes.has("task-hub-unscheduled-task"));

    expect(host?.classes.has("is-unscheduled-open")).toBe(true);
    expect(host?.classes.has("is-unscheduled-opening")).toBe(false);
    expect(panel?.classes.has("is-opening")).toBe(false);
    expect(row?.classes.has("is-completed")).toBe(true);
    expect(row?.classes.has("is-completing")).toBe(false);
  });

  it("schedules an unscheduled side-panel task to a specific time in day view", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const unscheduledTask = { ...task, id: "task-unscheduled-time", dueDate: undefined, rawLine: "- [ ] Timed", text: "Timed" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        calendarDayStartHour: 6,
        calendarDayEndHour: 22,
        unscheduledPanelOpen: true,
        unscheduledTasks: [unscheduledTask],
        selectedTaskIds: new Set(["task-unscheduled-time"]),
        sources: [],
        t: (key) => key
      },
      [unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-unscheduled-task"));
    const panel = collect(container).find((element) => element.classes.has("task-hub-calendar-day-unscheduled"));
    const sidebar = collect(container).find((element) => element.classes.has("task-hub-calendar-day-sidebar"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    if (column) column.boundingRect = { top: 0, height: 896 };
    const dataTransfer = new FakeDataTransfer();
    row?.dispatch("dragstart", { dataTransfer, clientY: 0 });
    column?.dispatch("drop", { dataTransfer, clientY: 168 });

    expect(panel?.parent).toBe(sidebar);
    expect(onTaskReschedule).toHaveBeenCalledWith(unscheduledTask, {
      dateKey: "2026-05-08",
      startMinutes: 540
    });
  });

  it("shows send to Dida in the unscheduled task context menu when Dida creation is enabled", () => {
    const container = new FakeElement();
    const onTaskJump = jest.fn();
    const onTaskDelete = jest.fn();
    const onTaskSendToDida = jest.fn();
    const unscheduledTask = { ...task, id: "task-unscheduled-dida", dueDate: undefined, rawLine: "- [ ] Send me", text: "Send me" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaCreate: true,
        allowTaskCreation: false,
        unscheduledPanelOpen: true,
        unscheduledTasks: [unscheduledTask],
        sources: [],
        t: (key) => key
      },
      [unscheduledTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump,
        onTaskSelect: jest.fn(),
        onTaskSelectionChange: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete: onTaskDelete,
        onTaskSendToDida,
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-unscheduled-task"));
    row!.dispatch("contextmenu");

    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["sourceVaultTask", "openSource", "deleteCalendarItem", "sendToDida"]);
    expect(mockMenus.at(-1)?.items[0].disabled).toBe(true);
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    mockMenus.at(-1)?.items[3].click?.();
    expect(onTaskJump).toHaveBeenCalledWith(unscheduledTask);
    expect(onTaskDelete).toHaveBeenCalledWith(unscheduledTask);
    expect(onTaskSendToDida).toHaveBeenCalledWith(unscheduledTask);
    expect(row?.classes.has("is-external-sending")).toBe(true);
  });

  it("supports bulk send to Dida from unscheduled task context menus", () => {
    const container = new FakeElement();
    const onTaskSelectionChange = jest.fn();
    const onTaskSendToDida = jest.fn();
    const firstTask = { ...task, id: "task-unscheduled-dida-1", dueDate: undefined, rawLine: "- [ ] First", text: "First" };
    const secondTask = { ...task, id: "task-unscheduled-dida-2", dueDate: undefined, rawLine: "- [ ] Second", text: "Second" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaCreate: true,
        allowTaskCreation: false,
        unscheduledPanelOpen: true,
        unscheduledTasks: [firstTask, secondTask],
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange,
        onTaskReschedule: jest.fn(),
        onTaskSendToDida,
        onToday: jest.fn()
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-unscheduled-task"));
    rows[0].dispatch("click");
    rows[1].dispatch("click", { metaKey: true });
    rows[1].dispatch("contextmenu");

    expect(new Set(onTaskSelectionChange.mock.calls.at(-1)?.[1])).toEqual(new Set([firstTask.id, secondTask.id]));
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["markComplete", "deleteCalendarItem", "sendToDida"]);
    mockMenus.at(-1)?.items[2].click?.();
    expect(onTaskSendToDida).toHaveBeenCalledWith(firstTask);
    expect(onTaskSendToDida).toHaveBeenCalledWith(secondTask);
  });

  it("does not make Apple Reminder tasks draggable when writeback is disabled", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [{ ...task, source: "apple-reminders" }],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));

    expect(item?.draggable).toBe(false);
  });

  it("reschedules a dragged Dida task when writeback and drag reschedule are enabled in month view", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const didaTask: TaskItem = {
      ...task,
      id: "dida-drag-month",
      filePath: "Dida/Inbox",
      rawLine: "Dida drag task",
      text: "Dida drag task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowDidaDragReschedule: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [didaTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(item?.draggable).toBe(true);
    expect(onTaskReschedule).toHaveBeenCalledWith(didaTask, "2026-05-12");
  });

  it("reschedules selected Dida tasks together to the dropped month day", () => {
    const container = new FakeElement();
    const onTaskSelectionChange = jest.fn();
    const onTaskReschedule = jest.fn();
    const firstTask: TaskItem = {
      ...task,
      id: "dida-drag-bulk-1",
      filePath: "Dida/Inbox",
      rawLine: "First Dida drag task",
      text: "First Dida drag task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    };
    const secondTask: TaskItem = {
      ...task,
      id: "dida-drag-bulk-2",
      filePath: "Dida/Inbox",
      rawLine: "Second Dida drag task",
      text: "Second Dida drag task",
      source: "dida",
      externalId: "task-2",
      externalListId: "project-1",
      dueDate: "2026-05-09"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowDidaDragReschedule: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange,
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-task"));
    items[0].dispatch("click");
    items[1].dispatch("click", { metaKey: true });
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    items[1].dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(new Set(onTaskSelectionChange.mock.calls.at(-1)?.[1])).toEqual(new Set([firstTask.id, secondTask.id]));
    expect(onTaskReschedule).toHaveBeenCalledWith(firstTask, "2026-05-12");
    expect(onTaskReschedule).toHaveBeenCalledWith(secondTask, "2026-05-12");
  });

  it("keeps multi-select drag reschedule working when transfer types disappear mid-drag", () => {
    const container = new FakeElement();
    const onTaskSelectionChange = jest.fn();
    const onTaskReschedule = jest.fn();
    const firstTask: TaskItem = {
      ...task,
      id: "dida-drag-fallback-1",
      filePath: "Dida/Inbox",
      rawLine: "First fallback drag task",
      text: "First fallback drag task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    };
    const secondTask: TaskItem = {
      ...task,
      id: "dida-drag-fallback-2",
      filePath: "Dida/Inbox",
      rawLine: "Second fallback drag task",
      text: "Second fallback drag task",
      source: "dida",
      externalId: "task-2",
      externalListId: "project-1",
      dueDate: "2026-05-09"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["dida"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowDidaWriteback: true,
        allowDidaDragReschedule: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange,
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-task"));
    items[0].dispatch("click");
    items[1].dispatch("click", { metaKey: true });
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    items[1].dispatch("dragstart", { dataTransfer });
    dataTransfer.hideTypes = true;
    targetDay?.dispatch("dragover", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(new Set(onTaskSelectionChange.mock.calls.at(-1)?.[1])).toEqual(new Set([firstTask.id, secondTask.id]));
    expect(onTaskReschedule).toHaveBeenCalledWith(firstTask, "2026-05-12");
    expect(onTaskReschedule).toHaveBeenCalledWith(secondTask, "2026-05-12");
  });

  it("reschedules a dragged Apple Reminder when writeback is enabled in month view", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(item?.draggable).toBe(true);
    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, "2026-05-12");
  });

  it("accepts task drops when dragover cannot read transfer data yet", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    dataTransfer.hideData = true;
    const dragover = targetDay?.dispatch("dragover", { dataTransfer });
    dataTransfer.hideData = false;
    targetDay?.dispatch("drop", { dataTransfer });

    expect(dragover?.preventDefault).toHaveBeenCalled();
    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, "2026-05-12");
  });

  it("accepts task drops when drag events cannot expose transfer types after dragstart", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    dataTransfer.hideTypes = true;
    const dragover = targetDay?.dispatch("dragover", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(dragover?.preventDefault).toHaveBeenCalled();
    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, "2026-05-12");
  });

  it("reschedules a dragged Apple Reminder when writeback is enabled in week view", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetSlot = collect(container).filter((element) => element.classes.has("task-hub-agenda-all-day-slot"))[2];
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetSlot?.dispatch("drop", { dataTransfer });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, "2026-05-06");
  });

  it("reschedules a dragged Apple Reminder when writeback is enabled in day view", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetSlot = collect(container).find((element) => element.classes.has("task-hub-agenda-all-day-slot"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetSlot?.dispatch("drop", { dataTransfer });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, "2026-05-08");
  });

  it("reschedules a dragged Apple Reminder to a specific time in day view", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const reminderTask = { ...task, source: "apple-reminders" as const, externalId: "reminder-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 60,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    column?.dispatch("drop", { dataTransfer, clientY: 196 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
      dateKey: "2026-05-08",
      startMinutes: 570
    });
  });

  it("shows the snapped time delta while dragging a timed item within the same day", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 60,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    item!.boundingRect = { top: 196 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("pointerdown", { dataTransfer, clientX: 40, clientY: 224 });
    item?.dispatch("dragstart", { dataTransfer, clientX: 40, clientY: 224 });
    column?.dispatch("dragover", { dataTransfer, clientX: 54, clientY: 210 });

    const feedback = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-drag-feedback"));
    expect(item?.classes.has("has-drag-feedback")).toBe(true);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("-15m");
    expect((feedback?.style as unknown as { left: string; top: string })).toEqual(expect.objectContaining({
      left: "62px",
      top: "226px"
    }));

    column?.dispatch("drop", { dataTransfer, clientX: 54, clientY: 210 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
      dateKey: "2026-05-08",
      startMinutes: 555
    });
    expect(item?.classes.has("has-drag-feedback")).toBe(false);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-drag-feedback"))).toBe(false);
  });

  it("shows drag time feedback when dragover cannot read transfer data yet", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 60,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    item!.boundingRect = { top: 196 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("pointerdown", { dataTransfer, clientX: 40, clientY: 224 });
    item?.dispatch("dragstart", { dataTransfer, clientX: 40, clientY: 224 });
    dataTransfer.hideData = true;
    column?.dispatch("dragover", { dataTransfer, clientX: 54, clientY: 210 });

    const feedback = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-drag-feedback"));
    expect(item?.classes.has("has-drag-feedback")).toBe(true);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("-15m");
  });

  it("keeps the pointer grab offset when dragstart reports an unusable y position", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T09:30"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 60,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    item!.boundingRect = { top: 196 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("pointerdown", { dataTransfer, clientY: 224 });
    item?.dispatch("dragstart", { dataTransfer, clientY: 0 });
    column?.dispatch("drop", { dataTransfer, clientY: 210 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
      dateKey: "2026-05-08",
      startMinutes: 555
    });
  });

  it("schedules a dragged vault task at a time when dropped on the day time grid", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 90,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    column?.dispatch("drop", { dataTransfer, clientY: 196 });

    expect(onTaskReschedule).toHaveBeenCalledWith(task, {
      dateKey: "2026-05-08",
      startMinutes: 570
    });
  });

  it("snaps dragged vault tasks to five-minute increments on the day time grid", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    column?.dispatch("drop", { dataTransfer, clientY: 174 });

    expect(onTaskReschedule).toHaveBeenCalledWith(task, {
      dateKey: "2026-05-08",
      startMinutes: 545
    });
  });

  it("reschedules a dragged Apple Calendar event to a specific time when dropped on the week time grid", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        defaultTimedTaskDurationMinutes: 60,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const column = collect(container).filter((element) => element.classes.has("task-hub-agenda-column"))[2];
    column.boundingRect = { top: 0 };
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    column.dispatch("drop", { dataTransfer, clientY: 224 });

    expect(onEventReschedule).toHaveBeenCalledWith(event, {
      dateKey: "2026-05-06",
      startMinutes: 600,
      durationMinutes: 60
    });
  });

  it("reschedules selected tasks and events together to the exact dropped month day", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const onEventReschedule = jest.fn();
    const selectedTask = { ...task, id: "selected-task", text: "Selected task", dueDate: "2026-05-08" };
    const selectedEvent = { ...event, id: "selected-event", title: "Selected event", start: "2026-05-09", allDay: true };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["selected-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [{ ...selectedEvent, calendarId: "calendar-1" }],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item"));
    const taskItem = items.find((element) => collect(element).some((child) => child.text === "Selected task"));
    const eventItem = items.find((element) => collect(element).some((child) => child.text === "Selected event"));
    eventItem?.dispatch("click", { metaKey: true });
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    taskItem?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(onTaskReschedule).toHaveBeenCalledWith(selectedTask, "2026-05-12");
    expect(onEventReschedule).toHaveBeenCalledWith(expect.objectContaining({ id: "selected-event" }), "2026-05-12");
  });

  it("renders a moving stack preview while muting the source selected calendar items", () => {
    const container = new FakeElement();
    const selectedTask = { ...task, id: "stack-task", text: "Stack task", dueDate: "2026-05-08" };
    const selectedEvent = { ...event, id: "stack-event", title: "Stack event", start: "2026-05-08", allDay: true, calendarId: "calendar-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["stack-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [selectedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item"));
    const taskItem = items.find((element) => collect(element).some((child) => child.text === "Stack task"));
    const eventItem = items.find((element) => collect(element).some((child) => child.text === "Stack event"));
    taskItem!.boundingRect = { left: 20, top: 40 };
    eventItem!.boundingRect = { left: 20, top: 90 };
    eventItem?.dispatch("click", { metaKey: true });
    const dataTransfer = new FakeDataTransfer();

    taskItem?.dispatch("dragstart", { dataTransfer, clientX: 60, clientY: 48 });

    const stack = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-drag-stack"));
    expect(stack).toBeDefined();
    expect(collect(stack!).filter((element) => element.classes.has("task-hub-calendar-drag-stack-card"))).toHaveLength(2);
    expect(eventItem?.classes.has("is-drag-muted")).toBe(true);
    expect(eventItem?.classes.has("is-drag-gathering")).toBe(false);
  });

  it("moves the stack preview from target dragover events after propagation is stopped", () => {
    const container = new FakeElement();
    const selectedTask = { ...task, id: "move-stack-task", text: "Move stack task", dueDate: "2026-05-08" };
    const selectedEvent = { ...event, id: "move-stack-event", title: "Move stack event", start: "2026-05-08", allDay: true, calendarId: "calendar-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["move-stack-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [selectedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item"));
    const taskItem = items.find((element) => collect(element).some((child) => child.text === "Move stack task"));
    const eventItem = items.find((element) => collect(element).some((child) => child.text === "Move stack event"));
    eventItem?.dispatch("click", { metaKey: true });
    const dataTransfer = new FakeDataTransfer();
    taskItem?.dispatch("dragstart", { dataTransfer, clientX: 40, clientY: 50 });
    const stack = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-drag-stack"));
    expect(styleValue(stack!, "left")).toBe("56px");
    expect(styleValue(stack!, "top")).toBe("66px");
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));

    targetDay?.dispatch("dragover", { dataTransfer, clientX: 280, clientY: 120 });

    expect(styleValue(stack!, "left")).toBe("296px");
    expect(styleValue(stack!, "top")).toBe("136px");
  });

  it("clears the stack preview and plays a scatter hint after dropping selected calendar items", () => {
    const container = new FakeElement();
    const selectedTask = { ...task, id: "scatter-task", text: "Scatter task", dueDate: "2026-05-08" };
    const selectedEvent = { ...event, id: "scatter-event", title: "Scatter event", start: "2026-05-08", allDay: true, calendarId: "calendar-1" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["scatter-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [selectedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item"));
    const taskItem = items.find((element) => collect(element).some((child) => child.text === "Scatter task"));
    const eventItem = items.find((element) => collect(element).some((child) => child.text === "Scatter event"));
    eventItem?.dispatch("click", { metaKey: true });
    const dataTransfer = new FakeDataTransfer();
    taskItem?.dispatch("dragstart", { dataTransfer, clientX: 60, clientY: 48 });
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    targetDay!.boundingRect = { left: 200, top: 120, width: 160, height: 120 };

    targetDay?.dispatch("drop", { dataTransfer, clientX: 240, clientY: 160 });

    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-drag-stack"))).toBe(false);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-drop-scatter"))).toBe(true);
    expect(eventItem?.classes.has("is-drag-muted")).toBe(false);
  });

  it("reschedules selected timed tasks and events by their relative timed offsets", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const onEventReschedule = jest.fn();
    const selectedTask = { ...task, id: "timed-task", text: "Timed task", dueDate: "2026-05-08", scheduledDate: "2026-05-08T09:00" };
    const selectedEvent = {
      ...event,
      id: "timed-event",
      title: "Timed event",
      start: "2026-05-08T10:00",
      end: "2026-05-08T11:30",
      allDay: false,
      calendarId: "calendar-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["timed-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [selectedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const timedItems = collect(container).filter((element) => element.classes.has("task-hub-calendar-timed-item"));
    const taskItem = timedItems.find((element) => collect(element).some((child) => child.text === "Timed task"));
    const eventItem = timedItems.find((element) => collect(element).some((child) => child.text === "Timed event"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    eventItem?.dispatch("click", { metaKey: true });
    const dataTransfer = new FakeDataTransfer();
    taskItem!.boundingRect = { top: 168 };
    taskItem?.dispatch("pointerdown", { dataTransfer, clientY: 168 });
    taskItem?.dispatch("dragstart", { dataTransfer, clientY: 168 });
    column?.dispatch("drop", { dataTransfer, clientY: 224 });

    expect(onTaskReschedule).toHaveBeenCalledWith(selectedTask, {
      dateKey: "2026-05-08",
      startMinutes: 600
    });
    expect(onEventReschedule).toHaveBeenCalledWith(selectedEvent, {
      dateKey: "2026-05-08",
      startMinutes: 660,
      durationMinutes: 90
    });
  });

  it("clamps relatively moved selected timed items to the day boundary", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const earlyTask = { ...task, id: "early-task", text: "Early task", dueDate: "2026-05-08", scheduledDate: "2026-05-08T00:15" };
    const anchorTask = { ...task, id: "anchor-task", text: "Anchor task", dueDate: "2026-05-08", scheduledDate: "2026-05-08T01:00" };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["early-task", "anchor-task"]),
        sources: [],
        t: (key) => key
      },
      [earlyTask, anchorTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const timedItems = collect(container).filter((element) => element.classes.has("task-hub-calendar-timed-item"));
    const anchorItem = timedItems.find((element) => collect(element).some((child) => child.text === "Anchor task"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    const dataTransfer = new FakeDataTransfer();
    anchorItem!.boundingRect = { top: 56 };
    anchorItem?.dispatch("pointerdown", { dataTransfer, clientY: 56 });
    anchorItem?.dispatch("dragstart", { dataTransfer, clientY: 56 });
    column?.dispatch("drop", { dataTransfer, clientY: 0 });

    expect(onTaskReschedule).toHaveBeenCalledWith(earlyTask, {
      dateKey: "2026-05-08",
      startMinutes: 0
    });
    expect(onTaskReschedule).toHaveBeenCalledWith(anchorTask, {
      dateKey: "2026-05-08",
      startMinutes: 0
    });
  });

  it("shows a delete action for selected task and event context menus and calls both delete handlers", () => {
    const container = new FakeElement();
    const onTaskDelete = jest.fn();
    const onEventDelete = jest.fn();
    const selectedTask = { ...task, id: "delete-task", text: "Delete task", dueDate: "2026-05-08" };
    const selectedEvent = {
      ...event,
      id: "delete-event",
      title: "Delete event",
      start: "2026-05-08",
      allDay: true,
      calendarId: "calendar-1"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        selectedTaskIds: new Set(["delete-task"]),
        appleCalendars: [{ id: "calendar-1", name: "Work", writable: true }],
        sources: [{ ...source, id: "apple-calendar:calendar-1", name: "Apple Calendar / Work" }],
        t: (key) => key
      },
      [selectedTask],
      [selectedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete,
        onEventReschedule: jest.fn(),
        onEventDelete,
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item"));
    const taskItem = items.find((element) => collect(element).some((child) => child.text === "Delete task"));
    const eventItem = items.find((element) => collect(element).some((child) => child.text === "Delete event"));
    taskItem?.dispatch("click");
    eventItem?.dispatch("click", { metaKey: true });
    eventItem?.dispatch("contextmenu");

    expect(taskItem?.classes.has("is-multi-selected")).toBe(true);
    expect(eventItem?.classes.has("is-multi-selected")).toBe(true);
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["deleteCalendarItem"]);
    mockMenus.at(-1)?.items[0].click?.();
    expect(onTaskDelete).toHaveBeenCalledWith(selectedTask);
    expect(onEventDelete).toHaveBeenCalledWith(selectedEvent);
  });

  it("renders visually overlapping timed task points as one stacked summary at the true start time", () => {
    const container = new FakeElement();
    const firstTask = {
      ...task,
      id: "task-overlap-1",
      text: "First",
      scheduledDate: "2026-05-08T09:30"
    };
    const secondTask = {
      ...task,
      id: "task-overlap-2",
      text: "Second",
      scheduledDate: "2026-05-08T09:45"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-calendar-timed-item"));
    const rowTops = rows.map((row) => (row.style as unknown as { top: string }).top);
    const count = collect(container).find((element) => element.classes.has("task-hub-calendar-overlap-count"));

    expect(rows).toHaveLength(1);
    expect(rowTops).toEqual(["196px"]);
    expect(rows[0].classes.has("is-overlap-stack")).toBe(true);
    expect(rows[0].draggable).toBe(true);
    expect(count?.text).toBe("+1");
  });

  it("drags the visible representative task from an overlap stack", () => {
    const container = new FakeElement();
    currentTestRoot = container;
    const onTaskReschedule = jest.fn();
    const firstTask = {
      ...task,
      id: "task-overlap-drag-1",
      text: "First drag",
      scheduledDate: "2026-05-08T09:30"
    };
    const secondTask = {
      ...task,
      id: "task-overlap-drag-2",
      text: "Second drag",
      scheduledDate: "2026-05-08T09:45"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    column!.boundingRect = { top: 0 };
    row!.boundingRect = { top: 196 };
    const dataTransfer = new FakeDataTransfer();
    row?.dispatch("pointerdown", { dataTransfer, clientY: 196 });
    row?.dispatch("dragstart", { dataTransfer, clientY: 196 });
    column?.dispatch("drop", { dataTransfer, clientY: 224 });

    expect(onTaskReschedule).toHaveBeenCalledWith(firstTask, {
      dateKey: "2026-05-08",
      startMinutes: 600
    });
    expect(onTaskReschedule).not.toHaveBeenCalledWith(secondTask, expect.anything());
  });

  it("places timed tasks beside overlapping calendar events", () => {
    const container = new FakeElement();
    const timedTask = {
      ...task,
      id: "task-event-overlap",
      text: "Task near event",
      scheduledDate: "2026-05-08T09:10"
    };
    const timedEvent = {
      ...event,
      id: "event-task-overlap",
      title: "Overlapping event",
      start: "2026-05-08T09:05:00",
      end: "2026-05-08T09:50:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [timedTask],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-calendar-timed-item"));
    const rowStyles = rows.map((row) => row.style as unknown as { left: string; right: string });

    expect(rows).toHaveLength(2);
    expect(rowStyles.map((style) => style.left)).toEqual(["calc(0% + 6px)", "calc(50% + 6px)"]);
    expect(rowStyles.map((style) => style.right)).toEqual(["calc(50% + 6px)", "calc(0% + 6px)"]);
  });

  it("renders timed Apple Reminders as point rows without a visible time label", () => {
    const container = new FakeElement();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T15:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const timeLabel = collect(container).find((element) => element.classes.has("task-hub-calendar-item-time"));

    expect(row?.classes.has("is-time-point")).toBe(true);
    expect((row?.style as unknown as { height: string }).height).toBe("28px");
    expect(timeLabel).toBeUndefined();
  });

  it("keeps visible time ranges for timed Apple Calendar events", () => {
    const container = new FakeElement();
    const timedEvent = {
      ...event,
      id: "event-timed",
      start: "2026-05-08T08:10:00",
      end: "2026-05-08T08:55:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const timeLabel = collect(container).find((element) => element.classes.has("task-hub-calendar-item-time"));

    expect(timeLabel?.text).toBe("08:10-08:55");
  });

  it("summarizes same-time task points instead of showing them side by side", () => {
    const container = new FakeElement();
    const firstTask = {
      ...task,
      id: "task-point-1",
      text: "First",
      scheduledDate: "2026-05-08T15:00"
    };
    const secondTask = {
      ...task,
      id: "task-point-2",
      text: "Second",
      scheduledDate: "2026-05-08T15:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-calendar-timed-item"));
    const rowTops = rows.map((row) => (row.style as unknown as { top: string }).top);
    const count = collect(container).find((element) => element.classes.has("task-hub-calendar-overlap-count"));

    expect(rows).toHaveLength(1);
    expect(rowTops).toEqual(["504px"]);
    expect(count?.text).toBe("+1");
  });

  it("uses an incomplete task as the visible representative for overlapping task points", () => {
    const container = new FakeElement();
    const completedTask = {
      ...task,
      id: "task-point-completed",
      text: "Done task",
      completed: true,
      scheduledDate: "2026-05-08T15:00",
      createdSortKey: "2026-05-08T12:00:00"
    };
    const openTask = {
      ...task,
      id: "task-point-open",
      text: "Open task",
      completed: false,
      scheduledDate: "2026-05-08T15:00",
      createdSortKey: "2026-05-08T11:00:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: true,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [completedTask, openTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const visibleRow = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const visibleTitle = visibleRow ? collect(visibleRow).find((element) => element.classes.has("task-hub-calendar-item-title")) : undefined;

    expect(visibleRow?.classes.has("is-completed")).toBe(false);
    expect(visibleTitle?.text).toBe("Open task");
  });

  it("expands same-time task overlaps into a small list when clicked", () => {
    const container = new FakeElement();
    const firstTask = {
      ...task,
      id: "task-point-1",
      text: "First",
      scheduledDate: "2026-05-08T15:00"
    };
    const secondTask = {
      ...task,
      id: "task-point-2",
      text: "Second",
      scheduledDate: "2026-05-08T15:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();

    const overlapPopover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-overlap-popover"));
    const titles = overlapPopover ? collect(overlapPopover).filter((element) => element.classes.has("task-hub-calendar-overlap-title")).map((element) => element.text) : [];

    expect(overlapPopover).toBeDefined();
    expect(titles).toEqual(["First", "Second"]);
  });

  it("completes a task from the overlap list checkbox without opening task details", () => {
    const container = new FakeElement();
    const onTaskComplete = jest.fn();
    const firstTask = {
      ...task,
      id: "task-point-1",
      text: "First",
      scheduledDate: "2026-05-08T15:00"
    };
    const secondTask = {
      ...task,
      id: "task-point-2",
      text: "Second",
      scheduledDate: "2026-05-08T15:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [firstTask, secondTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete,
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const overlapPopover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-overlap-popover"));
    const checkbox = overlapPopover ? collect(overlapPopover).find((element) => element.classes.has("task-hub-calendar-overlap-check")) : undefined;

    checkbox?.click();

    expect(onTaskComplete).toHaveBeenCalledWith(firstTask);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-overlap-popover"))).toBe(true);
    expect(collect(fakeDocument.body).some((element) => element.classes.has("task-hub-calendar-detail-popover"))).toBe(false);
  });

  it("does not show resize handles for timed Apple Reminders", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T10:00:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const handles = collect(container).filter((element) => element.classes.has("task-hub-calendar-resize-handle"));

    expect(handles).toHaveLength(0);
    expect(onTaskReschedule).not.toHaveBeenCalled();
  });

  it("does not resize Apple Reminders from the top edge", () => {
    const container = new FakeElement();
    const onTaskReschedule = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      scheduledDate: "2026-05-08T10:00:00"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [reminderTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule,
        onToday: jest.fn()
      }
    );

    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 252 });
    fakeDocument.dispatch("pointerup", { clientY: 252 });

    expect(topHandle).toBeUndefined();
    expect(onTaskReschedule).not.toHaveBeenCalled();
  });

  it("shows the snapped minute delta while resizing an Apple Calendar event", () => {
    const container = new FakeElement();
    const timedEvent = {
      ...event,
      start: "2026-05-08T10:00:00",
      end: "2026-05-08T11:00:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    const feedback = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-feedback"));
    const originalTop = styleValue(row!, "top");
    const originalHeight = styleValue(row!, "height");
    column!.boundingRect = { top: 0 };

    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 196 });

    expect(row?.classes.has("has-resize-feedback")).toBe(true);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("-30m");
    expect(styleValue(row!, "top")).toBe("196px");
    expect(styleValue(row!, "height")).toBe("80px");

    fakeDocument.dispatch("pointerup", { clientY: 196 });

    expect(row?.classes.has("has-resize-feedback")).toBe(false);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("");
    expect(styleValue(row!, "top")).toBe(originalTop);
    expect(styleValue(row!, "height")).toBe(originalHeight);
  });

  it("commits the last snapped resize target when pointerup reports a stale pointer position", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T10:00:00",
      end: "2026-05-08T11:00:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    column!.boundingRect = { top: 0 };

    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 196 });
    fakeDocument.dispatch("pointerup", { clientY: 0 });

    expect(onEventReschedule).toHaveBeenCalledWith(timedEvent, {
      dateKey: "2026-05-08",
      startMinutes: 570,
      durationMinutes: 90
    });
  });

  it("resizes an Apple Calendar event end time from the bottom edge", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T10:00:00",
      end: "2026-05-08T11:00:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const bottomHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-end"));
    const originalTop = styleValue(row!, "top");
    const originalHeight = styleValue(row!, "height");
    column!.boundingRect = { top: 0 };
    bottomHandle?.dispatch("pointerdown", { clientY: 280 });
    fakeDocument.dispatch("pointermove", { clientY: 308 });

    expect(styleValue(row!, "top")).toBe(originalTop);
    expect(styleValue(row!, "height")).toBe("80px");

    fakeDocument.dispatch("pointerup", { clientY: 308 });

    expect(onEventReschedule).toHaveBeenCalledWith(timedEvent, {
      dateKey: "2026-05-08",
      startMinutes: 600,
      durationMinutes: 90
    });
    expect(styleValue(row!, "top")).toBe(originalTop);
    expect(styleValue(row!, "height")).toBe(originalHeight);
  });

  it("restores the agenda scroll position after a day view rerender", () => {
    const container = new FakeElement();
    const timedEvent = {
      ...event,
      start: "2026-05-08T10:00:00",
      end: "2026-05-08T11:00:00",
      allDay: false
    };
    const render = (events: CalendarEvent[]) => renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      events,
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    render([timedEvent]);
    const agenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    agenda!.scrollTop = 360;
    agenda!.scrollLeft = 24;

    render([{ ...timedEvent, end: "2026-05-08T11:30:00" }]);

    const restoredAgenda = collect(container).find((element) => element.classes.has("task-hub-agenda"));
    expect(restoredAgenda?.scrollTop).toBe(360);
    expect(restoredAgenda?.scrollLeft).toBe(24);
  });

  it("does not create a timed task from the click synthesized after resizing an event", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();
    const onEventReschedule = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T10:00:00",
      end: "2026-05-08T11:00:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: true,
        sources: [source],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask,
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const bottomHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-end"));
    column!.boundingRect = { top: 0 };
    bottomHandle?.dispatch("pointerdown", { clientY: 280 });
    fakeDocument.dispatch("pointermove", { clientY: 308 });
    fakeDocument.dispatch("pointerup", { clientY: 308 });
    column?.dispatch("click", { clientY: 308 });

    expect(onEventReschedule).toHaveBeenCalled();
    expect(onDateCreateTask).not.toHaveBeenCalled();
  });

  it("does not make Apple Calendar events draggable when writeback is disabled", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));

    expect(item?.draggable).toBe(false);
  });

  it("reschedules a dragged Apple Calendar event when writeback is enabled in month view", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetDay = collect(container)
      .filter((element) => element.classes.has("task-hub-calendar-day"))
      .find((element) => collect(element).map((child) => child.text).includes("12"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetDay?.dispatch("drop", { dataTransfer });

    expect(item?.draggable).toBe(true);
    expect(onEventReschedule).toHaveBeenCalledWith(event, "2026-05-12");
  });

  it("reschedules a dragged Apple Calendar event when writeback is enabled in week view", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "week",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetSlot = collect(container).filter((element) => element.classes.has("task-hub-agenda-all-day-slot"))[2];
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetSlot?.dispatch("drop", { dataTransfer });

    expect(onEventReschedule).toHaveBeenCalledWith(event, "2026-05-06");
  });

  it("reschedules a dragged Apple Calendar event when writeback is enabled in day view", () => {
    const container = new FakeElement();
    const onEventReschedule = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: true,
        allowTaskCreation: false,
        sources: [source],
        t: (key) => key
      },
      [],
      [event],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const targetSlot = collect(container).find((element) => element.classes.has("task-hub-agenda-all-day-slot"));
    const dataTransfer = new FakeDataTransfer();
    item?.dispatch("dragstart", { dataTransfer });
    targetSlot?.dispatch("drop", { dataTransfer });

    expect(onEventReschedule).toHaveBeenCalledWith(event, "2026-05-08");
  });

  it("shows right-click delete and Apple Reminders send actions for vault tasks", () => {
    const container = new FakeElement();
    const onTaskJump = jest.fn();
    const onTaskDelete = jest.fn();
    const onTaskSendToAppleReminders = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump,
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete,
        onTaskSendToAppleReminders,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const contextEvent = item!.dispatch("contextmenu");
    mockMenus[0].items[1].click?.();
    mockMenus[0].items[2].click?.();
    mockMenus[0].items[3].click?.();

    expect(contextEvent.preventDefault).toHaveBeenCalled();
    expect(contextEvent.stopPropagation).toHaveBeenCalled();
    expect(item?.classes.has("is-selected")).toBe(true);
    expect(mockMenus[0].items[0].title).toBe("sourceVaultTask");
    expect(mockMenus[0].items[0].disabled).toBe(true);
    expect(mockMenus[0].items[1].title).toBe("openSource");
    expect(mockMenus[0].items[1].icon).toBe("external-link");
    expect(mockMenus[0].items[2].title).toBe("deleteCalendarItem");
    expect(mockMenus[0].items[2].icon).toBe("trash");
    expect(mockMenus[0].items[3].title).toBe("sendToAppleReminders");
    expect(mockMenus[0].items[3].icon).toBe("bell-plus");
    expect(onTaskJump).toHaveBeenCalledWith(task);
    expect(onTaskDelete).toHaveBeenCalledWith(task);
    expect(onTaskSendToAppleReminders).toHaveBeenCalledWith(task);
    expect(item?.classes.has("is-external-sending")).toBe(true);
  });

  it("shows both Apple Reminders and Dida send actions for vault tasks when both are enabled", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowDidaCreate: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete: jest.fn(),
        onTaskSendToAppleReminders: jest.fn(),
        onTaskSendToDida: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus[0].items.map((item) => item.title)).toEqual([
      "sourceVaultTask",
      "openSource",
      "deleteCalendarItem",
      "sendToAppleReminders",
      "sendToDida"
    ]);
  });

  it("shows a send target picker in calendar task details", () => {
    const container = new FakeElement();
    const onTaskSendToTarget = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowDidaCreate: true,
        allowTaskCreation: false,
        appleReminderLists: [{ id: "apple-list", name: "Inbox" }],
        didaProjects: [{ id: "dida-project", name: "Work" }],
        taskSendDefaultTarget: { type: "dida", projectId: "dida-project" },
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskSendToTarget,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const sendPicker = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-send-target-select"));

    expect(findText(popover as FakeElement, "sendTo")).toBeDefined();
    expect(sendPicker).toBeDefined();
    expect(sendPicker?.value).toBe("dida:dida-project");

    findText(popover as FakeElement, "sendTo")?.click();

    expect(onTaskSendToTarget).toHaveBeenCalledWith(task, { type: "dida", projectId: "dida-project" });
  });

  it("uses command or control clicks to build a task-only bulk menu in calendar views", () => {
    const container = new FakeElement();
    const onTaskComplete = jest.fn();
    const onTaskDelete = jest.fn();
    const onCreateTaskNote = jest.fn();
    const onTaskSelectionChange = jest.fn();
    const appleTask = {
      ...task,
      id: "apple-task",
      text: "Apple Task",
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      filePath: "Apple Reminders/Inbox",
      rawLine: ""
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault", "apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowAppleReminderCreate: true,
        allowTaskCreation: false,
        taskNotesEnabled: true,
        sources: [remindersSource],
        t: (key) => key
      },
      [task, appleTask],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete,
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskSelectionChange,
        onTaskReschedule: jest.fn(),
        onTaskDelete,
        onCreateTaskNote,
        onToday: jest.fn()
      }
    );

    const items = collect(container).filter((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-task"));
    items[0].dispatch("click");
    items[1].dispatch("click", { metaKey: true });
    items[1].dispatch("contextmenu");

    expect(items[0].classes.has("is-multi-selected")).toBe(true);
    expect(items[1].classes.has("is-multi-selected")).toBe(true);
    expect(new Set(onTaskSelectionChange.mock.calls.at(-1)?.[1])).toEqual(new Set(["task-1", "apple-task"]));
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["createTaskNote", "markComplete", "deleteCalendarItem"]);

    mockMenus.at(-1)?.items[0].click?.();
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    expect(onCreateTaskNote).toHaveBeenCalledWith(task);
    expect(onCreateTaskNote).toHaveBeenCalledWith(appleTask);
    expect(onTaskComplete).toHaveBeenCalledWith(task);
    expect(onTaskComplete).toHaveBeenCalledWith(appleTask);
    expect(onTaskDelete).toHaveBeenCalledWith(task);
    expect(onTaskDelete).toHaveBeenCalledWith(appleTask);
  });

  it("adds a calendar item note action when task notes are enabled", () => {
    const container = new FakeElement();
    const onCreateTaskNote = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        taskNotesEnabled: true,
        sources: [remindersSource],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskDelete: jest.fn(),
        onTaskSendToAppleReminders: jest.fn(),
        onCreateTaskNote,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item!.dispatch("contextmenu");
    mockMenus[0].items[1].click?.();

    expect(mockMenus[0].items[0].title).toBe("sourceVaultTask");
    expect(mockMenus[0].items[0].disabled).toBe(true);
    expect(mockMenus[0].items[1].title).toBe("createTaskNote");
    expect(mockMenus[0].items[1].icon).toBe("sticky-note");
    expect(onCreateTaskNote).toHaveBeenCalledWith(task);
  });

  it("selects every rendered span of a multi-day event when one span is clicked", () => {
    const container = new FakeElement();
    const multiDayEvent = {
      ...classEvent,
      id: "multi-day-select",
      title: "Multi-day select",
      start: "2026-09-17T09:00:00",
      end: "2026-09-19T18:00:00",
      allDay: false
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-09-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:class"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        sources: [classCalendarSource],
        t: (key) => key
      },
      [],
      [multiDayEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const cards = collect(container).filter((element) => element.classes.has("task-hub-calendar-item") && element.classes.has("is-multi-day"));
    cards[1]?.click();

    expect(cards).toHaveLength(3);
    expect(cards.every((element) => element.classes.has("is-selected"))).toBe(true);
  });

  it("shows only the enabled Apple destination in the calendar context menu", () => {
    const remindersOnlyContainer = new FakeElement();
    renderCalendarView(
      remindersOnlyContainer as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onTaskSendToAppleReminders: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(remindersOnlyContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["sourceVaultTask", "openSource", "deleteCalendarItem", "sendToAppleReminders"]);
  });

  it("keeps read-only Apple Calendar events display-only in the context menu", () => {
    const container = new FakeElement();
    const birthdayEvent: CalendarEvent = {
      id: "birthday-1",
      sourceId: "apple-calendar",
      title: "Birthday",
      start: "2026-05-08",
      allDay: true,
      calendarId: "birthdays",
      calendarName: "Birthdays"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:birthdays"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: true,
        allowAppleCalendarWriteback: true,
        allowAppleCalendarReminderConversion: true,
        allowTaskCreation: false,
        appleCalendars: [{ id: "birthdays", name: "Birthdays", writable: false }],
        sources: [{
          ...source,
          id: "apple-calendar:birthdays",
          name: "Apple Calendar / Birthdays"
        }],
        t: (key) => key
      },
      [],
      [birthdayEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventDelete: jest.fn(),
        onEventSendToAppleReminders: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["sourceAppleCalendar"]);
  });

  it("keeps delete available when no Apple send destination is enabled", () => {
    const disabledContainer = new FakeElement();
    renderCalendarView(
      disabledContainer as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["vault"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: false,
        allowTaskCreation: false,
        sources: [],
        t: (key) => key
      },
      [task],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(disabledContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus.at(-1)?.items).toHaveLength(3);
    expect(mockMenus.at(-1)?.items[0].title).toBe("sourceVaultTask");
    expect(mockMenus.at(-1)?.items[0].disabled).toBe(true);
    expect(mockMenus.at(-1)?.items[1].title).toBe("openSource");
    expect(mockMenus.at(-1)?.items[2].title).toBe("deleteCalendarItem");

    const remindersContainer = new FakeElement();
    renderCalendarView(
      remindersContainer as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowTaskCreation: false,
        sources: [remindersSource],
        t: (key) => key
      },
      [{ ...task, source: "apple-reminders", externalId: "reminder-1" }],
      [],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(remindersContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus).toHaveLength(2);
    expect(mockMenus.at(-1)?.items).toHaveLength(3);
    expect(mockMenus.at(-1)?.items[0].title).toBe("sourceAppleReminders");
    expect(mockMenus.at(-1)?.items[0].disabled).toBe(true);
    expect(mockMenus.at(-1)?.items[1].title).toBe("openSource");
    expect(mockMenus.at(-1)?.items[2].title).toBe("deleteFromAppleReminders");
  });

  it("keeps Apple Calendar delete in the context menu when the calendar is writable", () => {
    const container = new FakeElement();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      calendarId: "calendar-1",
      calendarName: "提醒"
    };

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "day",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-calendar:calendar-1"]),
        includeCompletedTasks: false,
        localAppleEnabled: true,
        localAppleSupported: true,
        localAppleRemindersEnabled: true,
        localAppleCalendarEnabled: true,
        allowAppleReminderWriteback: false,
        allowAppleCalendarWriteback: false,
        allowTaskCreation: false,
        appleCalendars: [{ id: "calendar-1", name: "提醒", writable: true }],
        sources: [{
          ...source,
          id: "apple-calendar:calendar-1",
          name: "Apple 日历 / 提醒"
        }],
        t: (key) => key
      },
      [],
      [timedEvent],
      {
        onLayerToggle: jest.fn(),
        onModeChange: jest.fn(),
        onMove: jest.fn(),
        onDateCreateTask: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskJump: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskReschedule: jest.fn(),
        onEventDelete: jest.fn(),
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.dispatch("contextmenu");

    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual([
      "sourceAppleCalendar",
      "deleteFromAppleCalendar"
    ]);
  });
});
