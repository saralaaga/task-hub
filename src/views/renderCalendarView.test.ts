jest.mock("obsidian", () => ({
  Menu: class {
    items: Array<{ title: string; icon: string; click?: () => void }> = [];
    shownAt: unknown;

    constructor() {
      mockMenus.push(this);
    }

    addItem(build: (item: { setTitle(title: string): unknown; setIcon(icon: string): unknown; onClick(click: () => void): unknown }) => void): void {
      const item = {
        title: "",
        icon: "",
        click: undefined as (() => void) | undefined,
        setTitle(title: string) {
          this.title = title;
          return this;
        },
        setIcon(icon: string) {
          this.icon = icon;
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
import type { CalendarEvent, CalendarSource, TaskItem } from "../types";

const mockMenus: Array<{ items: Array<{ title: string; icon: string; click?: () => void }>; shownAt: unknown }> = [];

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
let currentTestRoot: FakeElement | undefined;

class FakeElement {
  parent?: FakeElement;
  ownerDocument: Document;
  children: FakeElement[] = [];
  checked = false;
  disabled = false;
  draggable = false;
  text = "";
  type = "";
  attributes = new Map<string, string>();
  classes = new Set<string>();
  style = new Proxy({ setProperty: jest.fn() }, {
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

  empty(): void {
    this.children = [];
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  createEl(tag: string, options: { cls?: string; type?: string; text?: string } = {}): FakeElement {
    const child = this.append(options);
    child.type = options.type ?? tag;
    return child;
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
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

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  click(): void {
    let stopped = false;
    const event = {
      dataTransfer: new FakeDataTransfer(),
      clientX: 0,
      clientY: 0,
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
      preventDefault: event.preventDefault ?? jest.fn(),
      stopPropagation: event.stopPropagation ?? jest.fn()
    };
    for (const listener of this.listeners.get(name) ?? []) {
      listener(fakeEvent);
    }
    return fakeEvent;
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
  preventDefault(): void;
  stopPropagation(): void;
};

class FakeDataTransfer {
  effectAllowed = "";
  dropEffect = "";
  hideData = false;
  private values = new Map<string, string>();

  setData(type: string, value: string): void {
    this.values.set(type, value);
  }

  getData(type: string): string {
    if (this.hideData) return "";
    return this.values.get(type) ?? "";
  }

  get types(): string[] {
    return Array.from(this.values.keys());
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

describe("renderCalendarView", () => {
  beforeEach(() => {
    mockMenus.length = 0;
    fakeDocument.clear();
    currentTestRoot = undefined;
    (globalThis as unknown as { document: { querySelector(selector: string): FakeElement | null } }).document = {
      querySelector(selector: string): FakeElement | null {
        return currentTestRoot?.querySelector(selector) ?? null;
      }
    };
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

  it("renders calendar tasks with checkboxes and without task/event kind labels", () => {
    const container = new FakeElement();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
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

  it("opens existing calendar tasks instead of creating a new task", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();
    const onTaskSelect = jest.fn();

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
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item?.click();

    expect(onTaskSelect).toHaveBeenCalledWith(task);
    expect(onDateCreateTask).not.toHaveBeenCalled();
  });

  it("does not create a task when clicking an existing calendar event", () => {
    const container = new FakeElement();
    const onDateCreateTask = jest.fn();

    renderCalendarView(
      container as unknown as HTMLElement,
      {
        mode: "month",
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
      [event],
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

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    item?.click();

    expect(onDateCreateTask).not.toHaveBeenCalled();
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
      startMinutes: 570,
      durationMinutes: 60
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
      startMinutes: 555,
      durationMinutes: 60
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
      startMinutes: 555,
      durationMinutes: 60
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
        allowAppleCalendarTaskSend: true,
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
      startMinutes: 570,
      durationMinutes: 90
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

  it("splits overlapping timed items into side-by-side columns", () => {
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
    const rowStyles = rows.map((row) => row.style as unknown as { left: string; right: string });

    expect(rows).toHaveLength(2);
    expect(rowStyles).toEqual([
      expect.objectContaining({ left: "calc(0% + 6px)", right: "calc(50% + 6px)" }),
      expect.objectContaining({ left: "calc(50% + 6px)", right: "calc(0% + 6px)" })
    ]);
  });

  it("resizes an Apple Reminder start time from the top edge", () => {
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

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    column!.boundingRect = { top: 0 };
    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 196 });
    fakeDocument.dispatch("pointerup", { clientY: 196 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
      dateKey: "2026-05-08",
      startMinutes: 570,
      durationMinutes: 90
    });
  });

  it("resizes an Apple Reminder start later when the top edge moves downward", () => {
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

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    column!.boundingRect = { top: 0 };
    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 252 });
    fakeDocument.dispatch("pointerup", { clientY: 252 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
      dateKey: "2026-05-08",
      startMinutes: 630,
      durationMinutes: 30
    });
  });

  it("shows the snapped minute delta while resizing a timed item", () => {
    const container = new FakeElement();
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
        onTaskReschedule: jest.fn(),
        onToday: jest.fn()
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"));
    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    const feedback = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-feedback"));
    column!.boundingRect = { top: 0 };

    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 196 });

    expect(row?.classes.has("has-resize-feedback")).toBe(true);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("-30m");

    fakeDocument.dispatch("pointerup", { clientY: 196 });

    expect(row?.classes.has("has-resize-feedback")).toBe(false);
    expect((feedback as unknown as { textContent: string }).textContent).toBe("");
  });

  it("commits the last snapped resize target when pointerup reports a stale pointer position", () => {
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

    const column = collect(container).find((element) => element.classes.has("task-hub-agenda-column"));
    const topHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-start"));
    column!.boundingRect = { top: 0 };

    topHandle?.dispatch("pointerdown", { clientY: 224 });
    fakeDocument.dispatch("pointermove", { clientY: 196 });
    fakeDocument.dispatch("pointerup", { clientY: 0 });

    expect(onTaskReschedule).toHaveBeenCalledWith(reminderTask, {
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
    const bottomHandle = collect(container).find((element) => element.classes.has("task-hub-calendar-resize-handle") && element.classes.has("is-end"));
    column!.boundingRect = { top: 0 };
    bottomHandle?.dispatch("pointerdown", { clientY: 280 });
    fakeDocument.dispatch("pointermove", { clientY: 308 });
    fakeDocument.dispatch("pointerup", { clientY: 308 });

    expect(onEventReschedule).toHaveBeenCalledWith(timedEvent, {
      dateKey: "2026-05-08",
      startMinutes: 600,
      durationMinutes: 90
    });
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

  it("shows right-click send actions for each enabled Apple destination", () => {
    const container = new FakeElement();
    const onTaskSendToAppleCalendar = jest.fn();
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
        allowAppleCalendarTaskSend: true,
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
        onTaskSendToAppleReminders,
        onTaskSendToAppleCalendar,
        onToday: jest.fn()
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-calendar-item"));
    const contextEvent = item!.dispatch("contextmenu");
    mockMenus[0].items[0].click?.();
    mockMenus[0].items[1].click?.();

    expect(contextEvent.preventDefault).toHaveBeenCalled();
    expect(contextEvent.stopPropagation).toHaveBeenCalled();
    expect(mockMenus[0].items[0].title).toBe("sendToAppleCalendar");
    expect(mockMenus[0].items[0].icon).toBe("calendar-plus");
    expect(mockMenus[0].items[1].title).toBe("sendToAppleReminders");
    expect(mockMenus[0].items[1].icon).toBe("bell-plus");
    expect(onTaskSendToAppleCalendar).toHaveBeenCalledWith(task);
    expect(onTaskSendToAppleReminders).toHaveBeenCalledWith(task);
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
        allowAppleCalendarTaskSend: false,
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
        onTaskSendToAppleCalendar: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(remindersOnlyContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["sendToAppleReminders"]);
  });

  it("shows a disabled context menu hint when no Apple send destination is enabled", () => {
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
        allowAppleCalendarTaskSend: false,
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
        onTaskSendToAppleCalendar: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(disabledContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus.at(-1)?.items).toHaveLength(1);
    expect(mockMenus.at(-1)?.items[0].title).toBe("sendToAppleCalendarDisabled");

    const remindersContainer = new FakeElement();
    renderCalendarView(
      remindersContainer as unknown as HTMLElement,
      {
        mode: "month",
        focusDate: new Date("2026-05-08T12:00:00Z"),
        weekStart: "monday",
        visibleSourceIds: new Set(["apple-reminders"]),
        includeCompletedTasks: false,
        allowAppleReminderWriteback: false,
        allowAppleReminderCreate: true,
        allowAppleCalendarTaskSend: true,
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
        onTaskSendToAppleCalendar: jest.fn(),
        onToday: jest.fn()
      }
    );
    collect(remindersContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus).toHaveLength(1);
  });
});
