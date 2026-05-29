jest.mock("obsidian", () => ({
  setIcon: jest.fn(),
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
      key: event.key,
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
  value = "";
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
      key: event.key,
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
  key?: string;
  preventDefault(): void;
  stopPropagation(): void;
  pointerId?: number;
  target?: FakeElement;
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
    (globalThis as unknown as { window: { innerWidth: number; innerHeight: number; open: jest.Mock } }).window = {
      innerWidth: 1200,
      innerHeight: 800,
      open: jest.fn()
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

    expect(onDateCreateTask).toHaveBeenCalledWith({
      dateKey: "2026-05-01",
      startMinutes: 540
    });
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

  it("opens an editable popover for existing calendar tasks instead of creating a new task", () => {
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
    const logo = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    expect(save?.disabled).toBe(true);
    expect(logo?.classes.has("is-obsidian")).toBe(true);
    if (titleInput) {
      titleInput.value = "Updated task";
      titleInput.dispatch("input");
    }
    expect(save?.disabled).toBe(false);
    save?.click();
    expect(onTaskUpdate).toHaveBeenCalledWith(task, expect.objectContaining({ title: "Updated task" }));

    item?.click();
    const nextPopover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const deleteButton = collect(nextPopover as FakeElement).find((element) => element.text === "delete");
    expect(deleteButton?.classes.has("task-hub-calendar-detail-delete")).toBe(true);
    deleteButton?.click();
    expect(onTaskDelete).toHaveBeenCalledWith(task);
  });

  it("renders calendar detail notes with menu actions instead of card clicks", () => {
    const container = new FakeElement();
    const onOpenTaskNote = jest.fn();
    const onDeleteTaskNote = jest.fn();
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
            title: "One",
            body: "Calendar note body #tag",
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
    expect(collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Calendar note body");
    expect(collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-date"))?.text).toBe("2026-05-29");

    const menuButton = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-task-note-menu"));
    menuButton?.click();
    expect(mockMenus.at(-1)?.items.map((menuItem) => menuItem.title)).toEqual(["delete", "edit", "taskNoteEditInThino"]);
    mockMenus.at(-1)?.items[0].click?.();
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    expect(onDeleteTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(onOpenTaskNoteInThino).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("edits Apple Reminder notes from the calendar task popover", () => {
    const container = new FakeElement();
    const onTaskUpdate = jest.fn();
    const onTaskDelete = jest.fn();
    const reminderTask = {
      ...task,
      source: "apple-reminders" as const,
      externalId: "reminder-1",
      externalListId: "list-1",
      contextPreview: "Original notes"
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
    const headerSelect = collect(header as FakeElement).find((element) => element.type === "select");
    const headerTitle = collect(header as FakeElement).find((element) => element.text === "taskDetails");
    const notes = collect(popover as FakeElement).find((element) => element.type === "textarea");
    const formListRow = collect(popover as FakeElement).find((element) => element.text === "appleReminderList");
    const save = collect(popover as FakeElement).find((element) => element.text === "save");

    expect(header?.classes.has("has-calendar-select")).toBe(true);
    expect(headerTitle).toBeDefined();
    expect(headerSelect?.value).toBe("list-1");
    expect(formListRow).toBeUndefined();
    expect(notes?.value).toBe("Original notes");
    notes!.value = "Updated notes\nsecond line";
    notes!.dispatch("input");
    expect(save?.disabled).toBe(false);
    save?.click();

    expect(onTaskUpdate).toHaveBeenCalledWith(reminderTask, expect.objectContaining({ notes: "Updated notes\nsecond line" }));

    collect(container).find((element) => element.classes.has("task-hub-calendar-item"))?.click();
    const nextPopover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    collect(nextPopover as FakeElement).find((element) => element.text === "delete")?.click();
    expect(onTaskDelete).toHaveBeenCalledWith(reminderTask);
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
    const open = collect(popover as FakeElement).find((element) => element.text === "openSource");
    const deleteButton = collect(popover as FakeElement).find((element) => element.text === "delete");
    const allDayRow = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-check"));
    const hiddenTimeRows = collect(popover as FakeElement).filter((element) => element.classes.has("task-hub-calendar-detail-time-row") && element.classes.has("is-hidden"));
    expect(popover).toBeDefined();
    expect(allDayRow).toBeDefined();
    expect(hiddenTimeRows).toHaveLength(1);
    expect(save?.disabled).toBe(true);
    expect(titleInput?.disabled).toBe(true);
    expect(deleteButton).toBeUndefined();
    open?.click();
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

    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const dateRow = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-date-row"));
    const timeRow = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-time-row"));

    expect(dateRow).toBeDefined();
    expect(collect(dateRow as FakeElement).some((element) => element.classes.has("task-hub-calendar-detail-field"))).toBe(true);
    expect(collect(dateRow as FakeElement).some((element) => element.classes.has("task-hub-calendar-detail-check"))).toBe(true);
    expect(timeRow).toBeDefined();
    expect(collect(timeRow as FakeElement).filter((element) => element.classes.has("task-hub-calendar-detail-field"))).toHaveLength(2);
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
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const logo = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-logo"));
    expect(logo?.classes.has("is-apple")).toBe(true);
  });

  it("edits Apple Calendar event notes and keeps calendar selector on one row", () => {
    const container = new FakeElement();
    const onEventUpdate = jest.fn();
    const onEventDelete = jest.fn();
    const timedEvent = {
      ...event,
      start: "2026-05-08T09:00",
      end: "2026-05-08T10:00",
      allDay: false,
      description: "Original event notes",
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
        onEventDelete,
        onToday: jest.fn()
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const popover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    const header = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-header"));
    const headerSelect = collect(header as FakeElement).find((element) => element.type === "select");
    const notes = collect(popover as FakeElement).find((element) => element.type === "textarea");
    const formCalendarRow = collect(popover as FakeElement).find((element) => element.classes.has("task-hub-calendar-detail-inline-row"));
    const save = collect(popover as FakeElement).find((element) => element.text === "save");

    expect(notes?.value).toBe("Original event notes");
    expect(headerSelect?.value).toBe("calendar-1");
    expect(formCalendarRow).toBeUndefined();
    notes!.value = "Updated event notes";
    notes!.dispatch("input");
    save?.click();

    expect(onEventUpdate).toHaveBeenCalledWith(timedEvent, expect.objectContaining({ notes: "Updated event notes" }));

    collect(container).find((element) => element.classes.has("task-hub-calendar-timed-item"))?.click();
    const nextPopover = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-calendar-detail-popover"));
    collect(nextPopover as FakeElement).find((element) => element.text === "delete")?.click();
    expect(onEventDelete).toHaveBeenCalledWith(timedEvent);
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
    expect(count?.text).toBe("+1");
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
    mockMenus[0].items[0].click?.();
    mockMenus[0].items[1].click?.();
    mockMenus[0].items[2].click?.();

    expect(contextEvent.preventDefault).toHaveBeenCalled();
    expect(contextEvent.stopPropagation).toHaveBeenCalled();
    expect(item?.classes.has("is-selected")).toBe(true);
    expect(mockMenus[0].items[0].title).toBe("openSource");
    expect(mockMenus[0].items[0].icon).toBe("external-link");
    expect(mockMenus[0].items[1].title).toBe("deleteCalendarItem");
    expect(mockMenus[0].items[1].icon).toBe("trash");
    expect(mockMenus[0].items[2].title).toBe("sendToAppleReminders");
    expect(mockMenus[0].items[2].icon).toBe("bell-plus");
    expect(onTaskJump).toHaveBeenCalledWith(task);
    expect(onTaskDelete).toHaveBeenCalledWith(task);
    expect(onTaskSendToAppleReminders).toHaveBeenCalledWith(task);
    expect(item?.classes.has("is-external-sending")).toBe(true);
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
    mockMenus[0].items[0].click?.();

    expect(mockMenus[0].items[0].title).toBe("createTaskNote");
    expect(mockMenus[0].items[0].icon).toBe("sticky-note");
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

    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["openSource", "deleteCalendarItem", "sendToAppleReminders"]);
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

    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["sendToAppleRemindersDisabled"]);
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

    expect(mockMenus.at(-1)?.items).toHaveLength(2);
    expect(mockMenus.at(-1)?.items[0].title).toBe("openSource");
    expect(mockMenus.at(-1)?.items[1].title).toBe("deleteCalendarItem");

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
    collect(remindersContainer).find((element) => element.classes.has("task-hub-calendar-item"))?.dispatch("contextmenu");

    expect(mockMenus).toHaveLength(2);
    expect(mockMenus.at(-1)?.items).toHaveLength(1);
    expect(mockMenus.at(-1)?.items[0].title).toBe("openSource");
  });
});
