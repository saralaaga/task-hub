jest.mock("obsidian", () => ({
  setIcon: jest.fn(),
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

import { renderTasksView } from "./renderTasksView";
import type { TaskItem } from "../types";

const mockMenus: Array<{ items: Array<{ title: string; icon: string; disabled?: boolean; click?: () => void }>; shownAt: unknown }> = [];
const fakeWindow = {
  matchMedia: undefined as ((query: string) => MediaQueryList) | undefined
};

class FakeElement {
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
  open = false;
  text = "";
  type = "";
  value = "";
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  parent?: FakeElement;
  focused = false;
  scrollTop = 0;
  classes = new Set<string>();
  style = { setProperty: jest.fn() };
  showPicker = jest.fn();
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();

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

  empty(): void {
    this.children = [];
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = undefined;
    this.focused = false;
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  createEl(tag: string, options: { attr?: Record<string, string>; cls?: string; type?: string; text?: string; value?: string } = {}): FakeElement {
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

  insertBefore(child: FakeElement, reference: FakeElement): void {
    child.parent = this;
    this.children = this.children.filter((existing) => existing !== child);
    const index = this.children.indexOf(reference);
    if (index === -1) {
      this.children.push(child);
      return;
    }
    this.children.splice(index, 0, child);
  }

  appendChild(child: FakeElement): FakeElement {
    const wasFocusedMove = child.parent === this && child.focused;
    child.parent = this;
    this.children = this.children.filter((existing) => existing !== child);
    this.children.push(child);
    if (wasFocusedMove) child.focused = false;
    return child;
  }

  get parentElement(): FakeElement | undefined {
    return this.parent;
  }

  closest(selector: string): FakeElement | null {
    if (selector.startsWith(".")) {
      const classes = selector.split(".").filter(Boolean);
      if (classes.every((cls) => this.classes.has(cls))) return this;
    }
    return this.parent?.closest(selector) ?? null;
  }

  createSvg(tag: string, options: { attr?: Record<string, string> } = {}): FakeElement {
    const child = this.append();
    child.type = tag;
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      child.attrs.set(name, value);
    }
    return child;
  }

  setAttr(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  toggleClass(cls: string, enabled: boolean): void {
    if (enabled) {
      this.classes.add(cls);
    } else {
      this.classes.delete(cls);
    }
  }

  addClass(cls: string): void {
    this.classes.add(cls);
  }

  removeClass(cls: string): void {
    this.classes.delete(cls);
  }

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  }

  change(): void {
    for (const listener of this.listeners.get("change") ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  }

  input(): void {
    for (const listener of this.listeners.get("input") ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  }

  focus(): void {
    this.focused = true;
    const root = rootOf(this);
    for (const element of collect(root)) {
      if (element !== this) element.focused = false;
    }
    for (const listener of this.listeners.get("focus") ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  }

  dispatch(name: string, eventOverrides: Partial<FakeEvent> = {}): FakeEvent {
    const event = {
      key: "",
      target: this,
      preventDefault: jest.fn(),
      stopped: false,
      stopPropagation: jest.fn(function (this: FakeEvent & { stopped?: boolean }) {
        this.stopped = true;
      }),
      ...eventOverrides
    } as FakeEvent & { stopped?: boolean; target?: FakeElement };
    let current: FakeElement | undefined = this;
    while (current) {
      for (const listener of current.listeners.get(name) ?? []) {
        listener(event);
      }
      if (event.stopped) break;
      current = current.parent;
    }
    return event;
  }

  dispatchSelf(name: string, eventOverrides: Partial<FakeEvent> = {}): FakeEvent {
    const event = { key: "", target: this, preventDefault: jest.fn(), stopPropagation: jest.fn(), ...eventOverrides } as FakeEvent;
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
    return event;
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement();
    child.parent = this;
    child.text = options.text ?? "";
    for (const cls of (options.cls ?? "").split(" ").filter(Boolean)) {
      child.classes.add(cls);
    }
    this.children.push(child);
    return child;
  }
}

type FakeEvent = {
  key: string;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: FakeElement;
  stopped?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
};

const baseTask: TaskItem = {
  id: "apple-reminders:1",
  externalId: "reminder-1",
  externalSourceName: "Reminders",
  filePath: "Apple Reminders/Reminders",
  line: 0,
  rawLine: "",
  text: "Buy milk",
  completed: false,
  tags: [],
  dueDate: "2026-05-08",
  source: "apple-reminders"
};

function findCheckbox(element: FakeElement): FakeElement | undefined {
  if (element.type === "checkbox") return element;
  for (const child of element.children) {
    const found = findCheckbox(child);
    if (found) return found;
  }
  return undefined;
}

function collect(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collect)];
}

function rootOf(element: FakeElement): FakeElement {
  let root = element;
  while (root.parent) root = root.parent;
  return root;
}

function findElementByText(element: FakeElement, text: string): FakeElement | undefined {
  return collect(element).find((child) => child.text === text);
}

function leaveTaskDetailEditor(element: FakeElement): void {
  collect(element).find((child) => child.classes.has("task-hub-detail-editor"))?.dispatchSelf("mouseleave");
}

function textValues(element: FakeElement): string[] {
  return collect(element).map((child) => child.text).filter(Boolean);
}

function taskRowTitle(row: FakeElement): string | undefined {
  return collect(row).find((element) => element.classes.has("task-hub-task-text"))?.text;
}

describe("renderTasksView", () => {
  beforeEach(() => {
    mockMenus.length = 0;
  });

  const handlers = () => ({
    onComplete: jest.fn(),
    onJump: jest.fn(),
    onSendToAppleReminders: jest.fn(),
    onSendToDida: jest.fn(),
    onSendToTarget: jest.fn(),
    onSelect: jest.fn(),
    onTagSelect: jest.fn(),
    onSourceSelect: jest.fn(),
    onAppleReminderListChange: jest.fn(),
    onTaskUpdate: jest.fn(),
    onTaskDelete: jest.fn(),
    onCreateTaskNote: jest.fn(),
    onOpenTaskNote: jest.fn(),
    onDeleteTaskNote: jest.fn(),
    onOpenTaskNoteInThino: jest.fn()
  });

  it("disables Apple Reminders checkboxes when writeback is disabled", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: false }
    );

    expect(findCheckbox(container)?.disabled).toBe(true);
  });

  it("enables Apple Reminders checkboxes when writeback is enabled", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(findCheckbox(container)?.disabled).toBe(false);
  });

  it("renders a subtask chevron and expands child rows under the parent", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      filePath: "Project.md",
      rawLine: "- [ ] Parent",
      text: "Parent"
    };
    const child: TaskItem = {
      ...parent,
      id: "child",
      line: 1,
      rawLine: "  - [ ] Child",
      text: "Child",
      dueDate: undefined,
      indent: 1,
      parentId: "parent"
    };
    const viewHandlers = handlers();
    const onToggleTaskExpanded = jest.fn();

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, child],
      [parent, child],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, onToggleTaskExpanded }
    );

    expect(collect(container).filter((element) => element.classes.has("task-hub-task-row"))).toHaveLength(1);
    collect(container).find((element) => element.classes.has("task-hub-subtask-toggle"))?.click();
    expect(onToggleTaskExpanded).toHaveBeenCalledWith(parent);

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, child],
      [parent, child],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, expandedTaskIds: new Set(["parent"]), onToggleTaskExpanded }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-task-row"));
    expect(rows.map(taskRowTitle)).toEqual(["Parent", "Child"]);
    expect(rows[1].attrs.get("data-task-depth")).toBe("1");
  });

  it("keeps linked-note subtasks out of the no-date top-level bucket after reparenting", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      filePath: "Project.md",
      rawLine: "- [ ] Parent 📅 2026-05-08",
      text: "Parent"
    };
    const linkedSubtask: TaskItem = {
      ...parent,
      id: "linked-subtask",
      filePath: "Thino/20260621141201.md",
      line: 14,
      rawLine: "- [ ] 测试多任务关联 #p/论文 ",
      text: "测试多任务关联",
      tags: ["#p/论文"],
      dueDate: undefined,
      parentId: "parent",
      indent: 1
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, linkedSubtask],
      [parent, linkedSubtask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(textValues(container)).not.toContain("noDate (1)");
    expect(collect(container).filter((element) => element.classes.has("task-hub-task-row"))).toHaveLength(1);
  });

  it("applies source colors to Apple Reminders task rows", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, sourceColors: { "apple-reminders": "#22c55e" } }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
  });

  it("renders tasks as a single-column list ordered by date", () => {
    const container = new FakeElement();
    const noDate = { ...baseTask, id: "no-date", text: "No date", dueDate: undefined };
    const sooner = { ...baseTask, id: "soon", text: "Soon", dueDate: "2026-05-08" };
    const tomorrow = { ...baseTask, id: "tomorrow", text: "Tomorrow", dueDate: "2026-05-09" };
    const later = { ...baseTask, id: "later", text: "Later", dueDate: "2026-05-30" };

    renderTasksView(
      container as unknown as HTMLElement,
      [noDate, later, tomorrow, sooner],
      [noDate, later, tomorrow, sooner],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const flow = collect(container).find((element) => element.classes.has("task-hub-task-list-flow"));
    const rows = collect(container).filter((element) => element.classes.has("task-hub-task-row"));

    expect(flow).toBeDefined();
    expect(collect(container).some((element) => element.classes.has("task-hub-task-card-flow"))).toBe(false);
    expect(rows.map((row) => taskRowTitle(row))).toEqual(["Soon", "Tomorrow", "Later", "No date"]);
  });

  it("applies the Obsidian theme color to vault task rows", () => {
    const container = new FakeElement();
    const vaultTask = { ...baseTask, id: "vault-1", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };

    renderTasksView(
      container as unknown as HTMLElement,
      [vaultTask],
      [vaultTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, sourceColors: { vault: "var(--interactive-accent)" } }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "var(--interactive-accent)");
  });

  it("marks task details with the selected task source logo and color", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, sourceColors: { "apple-reminders": "#22c55e" } }
    );

    const details = collect(container).find((element) => element.classes.has("task-hub-task-details"));
    const logo = collect(details as FakeElement).find((element) => element.classes.has("task-hub-detail-source-logo"));

    expect(details?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
    expect(logo?.classes.has("is-apple")).toBe(true);
  });

  it("marks Dida task details with the Dida source logo", () => {
    const container = new FakeElement();
    const didaTask = {
      ...baseTask,
      id: "dida-logo",
      source: "dida" as const,
      externalId: "dida-1",
      externalListId: "project-1",
      externalSourceName: "Dida",
      filePath: "Dida/Inbox"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [didaTask],
      [didaTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: false, allowDidaWriteback: true, sourceColors: { dida: "#3b82f6" } }
    );

    const details = collect(container).find((element) => element.classes.has("task-hub-task-details"));
    const logo = collect(details as FakeElement).find((element) => element.classes.has("task-hub-detail-source-logo"));

    expect(logo?.classes.has("is-dida")).toBe(true);
  });

  it("uses the 2023 Obsidian mark viewBox for vault task details", () => {
    const container = new FakeElement();
    const vaultTask = {
      ...baseTask,
      id: "vault-logo",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Task Hub.md",
      rawLine: "- [ ] Review logo",
      source: "vault" as const
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [vaultTask],
      [vaultTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key
    );

    const details = collect(container).find((element) => element.classes.has("task-hub-task-details"));
    const logo = collect(details as FakeElement).find((element) => element.classes.has("task-hub-detail-source-logo"));
    const svg = collect(logo as FakeElement).find((element) => element.type === "svg");
    const path = collect(logo as FakeElement).find((element) => element.type === "path");

    expect(logo?.classes.has("is-obsidian")).toBe(true);
    expect(svg?.attrs.get("viewBox")).toBe("0 0 70 90");
    expect(path?.attrs.get("d")).toContain("M25.894 56.42");
  });

  it("uses Apple Reminder list colors for task rows and details", () => {
    const container = new FakeElement();
    const task = { ...baseTask, externalListId: "personal" };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        sourceColors: { "apple-reminders": "#f59e0b" },
        taskColors: { personal: "#22c55e" }
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    const details = collect(container).find((element) => element.classes.has("task-hub-task-details"));

    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
    expect(details?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
  });

  it("renders task tags as individual tag chips", () => {
    const container = new FakeElement();
    const task = { ...baseTask, tags: ["#project", "#client/acme"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const chips = collect(container).filter((element) => element.classes.has("task-hub-task-tag"));
    expect(chips.map((chip) => chip.text)).toEqual(["#project", "#client/acme"]);
  });

  it("keeps task list rows compact without date or source labels", () => {
    const container = new FakeElement();
    const task = {
      ...baseTask,
      externalSourceName: "Reminders",
      filePath: "Apple Reminders/Reminders",
      tags: ["#project"]
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"))!;
    expect(textValues(row)).toEqual(["Buy milk", "#project"]);
  });

  it("uses task tag chips as clickable filters without rendering the sidebar tag panel", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, tags: ["#project", "#client/acme"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const sidebarTagPanel = collect(container).find((element) => element.classes.has("task-hub-sidebar-tag-panel"));
    const chip = collect(container).find((element) => element.classes.has("task-hub-task-tag") && element.text === "#project");

    expect(sidebarTagPanel).toBeUndefined();
    expect(chip).toBeDefined();
    chip!.click();
    expect(viewHandlers.onTagSelect).toHaveBeenCalledWith("#project");
  });

  it("shows a right-click delete action for task list rows", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    const event = row!.dispatch("contextmenu");
    mockMenus[0].items.find((item) => item.title === "deleteFromAppleReminders")?.click?.();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(row?.classes.has("is-selected")).toBe(true);
    expect(mockMenus[0].items.map((item) => item.title)).toEqual(["sourceAppleReminders", "markComplete", "openSource", "deleteFromAppleReminders"]);
    expect(mockMenus[0].items[0].disabled).toBe(true);
    expect(mockMenus[0].items.find((item) => item.title === "deleteFromAppleReminders")?.icon).toBe("trash");
    expect(viewHandlers.onTaskDelete).toHaveBeenCalledWith(baseTask);
  });

  it("uses command or control clicks to build a multi-task context menu", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const vaultTask = { ...baseTask, id: "vault-1", source: "vault" as const, filePath: "Inbox.md", externalSourceName: undefined };
    const appleTask = { ...baseTask, id: "apple-1" };

    renderTasksView(
      container as unknown as HTMLElement,
      [vaultTask, appleTask],
      [vaultTask, appleTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        allowAppleReminderCreate: true,
        taskNotesEnabled: true,
        selectedTaskId: "vault-1"
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-task-row"));
    rows[1].dispatch("click", { ctrlKey: true } as Partial<FakeEvent>);
    rows[1].dispatch("contextmenu");

    expect(rows[0].classes.has("is-multi-selected")).toBe(true);
    expect(rows[1].classes.has("is-multi-selected")).toBe(true);
    expect(viewHandlers.onSelect).toHaveBeenLastCalledWith(appleTask, {
      additive: true,
      selectedTaskIds: ["vault-1", "apple-1"]
    });
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["createTaskNote", "markComplete", "deleteCalendarItem"]);

    mockMenus.at(-1)?.items[1].click?.();
    expect(viewHandlers.onComplete).toHaveBeenCalledWith(vaultTask);
    expect(viewHandlers.onComplete).toHaveBeenCalledWith(appleTask);
    expect(viewHandlers.onSendToAppleReminders).not.toHaveBeenCalled();
  });

  it("shows task note counts and note links when task notes are enabled", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskNotesEnabled: true,
        getTaskNoteCount: () => 2,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/one.md",
            related: [],
            history: [],
            title: "Remember to attach the receipt.",
            body: "Remember to attach the receipt.\nSecond line #比赛 #client/acme",
            bodyStartLine: 10,
            tags: ["#比赛", "#client/acme"],
            createdAt: "2026-05-29T10:30:12"
          },
          {
            path: "Task Hub Notes/two.md",
            related: [],
            history: [],
            title: "Two",
            body: "Call vendor after payment.",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-28T09:00:00"
          }
        ]
      }
    );

    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-count"))?.text).toBe("2");
    expect(textValues(container)).toContain("notes");
    expect(collect(container).filter((element) => element.classes.has("task-hub-task-details"))).toHaveLength(1);
    expect(collect(container).filter((element) => element.classes.has("task-hub-task-notes"))).toHaveLength(1);
    const noteCard = collect(container).find((element) => element.classes.has("task-hub-task-note-card"));
    noteCard?.click();
    expect(viewHandlers.onOpenTaskNote).not.toHaveBeenCalled();
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-title"))?.text).toBe("one");
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Remember to attach");
    expect(collect(noteCard as FakeElement).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Second line");
    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-date"))?.text).toBe("2026-05-29");
    expect(collect(container).filter((element) => element.classes.has("task-hub-task-tag")).map((element) => element.text)).toEqual([
      "#比赛",
      "#client/acme"
    ]);
    const menu = collect(container).find((element) => element.classes.has("task-hub-task-note-menu"));
    menu?.click();
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["delete", "edit"]);
    mockMenus.at(-1)?.items[1].click?.();
    expect(viewHandlers.onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("shows delete, edit, and Thino edit note menu actions", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskNotesEnabled: true,
        allowThinoNoteEdit: true,
        getTaskNoteCount: () => 1,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/one.md",
            related: [],
            history: [],
            title: "One",
            body: "Body",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          }
        ]
      }
    );

    collect(container).find((element) => element.classes.has("task-hub-task-note-menu"))?.click();
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["delete", "edit", "taskNoteEditInThino"]);
    mockMenus.at(-1)?.items[0].click?.();
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    expect(viewHandlers.onDeleteTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNoteInThino).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("renders note tags inline instead of duplicating them below the note body", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskNotesEnabled: true,
        getTaskNoteCount: () => 1,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/one.md",
            related: [],
            history: [],
            title: "One",
            body: "测试一下\n正文 #标签",
            bodyStartLine: 10,
            tags: ["#标签"],
            createdAt: "2026-05-29T10:30:12"
          }
        ]
      }
    );

    expect(collect(container).filter((element) => element.classes.has("task-hub-task-note-tags"))).toHaveLength(0);
    expect(collect(container).filter((element) => element.classes.has("task-hub-task-tag")).map((element) => element.text)).toEqual(["#标签"]);
    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-date"))?.text).toBe("2026-05-29");
  });

  it("keeps a single-line task note body visible in the preview", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskNotesEnabled: true,
        getTaskNoteCount: () => 1,
        getTaskNotes: () => [
          {
            path: "Thino/20260621142421.md",
            related: [],
            history: [],
            title: "20260621142421",
            body: "- [ ] 子任务的任务",
            bodyStartLine: 13,
            tags: [],
            createdAt: "2026-06-21T14:24:21"
          }
        ]
      }
    );

    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-title"))?.text).toBe("20260621142421");
    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toBe("- [ ] 子任务的任务");
  });

  it("uses the supplied Markdown renderer for note bodies", () => {
    const container = new FakeElement();
    const renderNoteMarkdown = jest.fn((target: HTMLElement, markdown: string) => {
      target.createEl("ul", { text: markdown });
    });

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskNotesEnabled: true,
        renderNoteMarkdown,
        getTaskNoteCount: () => 1,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/list.md",
            related: [],
            history: [],
            title: "List",
            body: "- item one\n- item two",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          }
        ]
      }
    );

    expect(renderNoteMarkdown).toHaveBeenCalledWith(expect.anything(), "- item one\n- item two", "Task Hub Notes/list.md");
    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-title"))?.text).toBe("list");
    expect(collect(container).find((element) => element.type === "ul")?.text).toBe("- item one\n- item two");
  });

  it("adds a right-click task note action only when task notes are enabled", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, taskNotesEnabled: true }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    row!.dispatch("contextmenu");
    mockMenus[0].items[1].click?.();

    expect(mockMenus[0].items[0].title).toBe("sourceAppleReminders");
    expect(mockMenus[0].items[0].disabled).toBe(true);
    expect(mockMenus[0].items[1].title).toBe("createTaskNote");
    expect(mockMenus[0].items[1].icon).toBe("sticky-note");
    expect(viewHandlers.onCreateTaskNote).toHaveBeenCalledWith(baseTask);
  });

  it("edits Apple Reminder title, date, and tags from the task details pane", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, tags: ["#home"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const title = collect(container).find((element) => element.classes.has("task-hub-detail-title-input"));
    const date = collect(container).find((element) => element.type === "date");
    const tags = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    title!.value = "Buy oat milk";
    title!.input();
    date!.value = "2026-05-09";
    date!.change();
    tags!.value = "#errand #client-acme";
    leaveTaskDetailEditor(container);

    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, {
      kind: "task",
      title: "Buy oat milk",
      date: "2026-05-09",
      startTime: undefined,
      tags: ["#home", "#errand", "#client-acme"],
      alertMinutesBefore: null
    });
  });

  it("edits vault task tags from the task details pane", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = {
      ...baseTask,
      id: "vault-tags",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Task Hub.md",
      rawLine: "- [ ] Buy milk 📅 2026-05-08 #home",
      source: "vault" as const,
      tags: ["#home"]
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key
    );

    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home"]);

    input!.value = "#errand";
    input!.dispatch("keydown", { key: " " });
    leaveTaskDetailEditor(container);

    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, expect.objectContaining({
      tags: ["#home", "#errand"]
    }));
  });

  it("hides Apple Reminder recurrence and notes in task details until edit details is checked", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = {
      ...baseTask,
      contextPreview: "Original notes",
      recurrence: "RRULE:FREQ=WEEKLY"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const extra = collect(container).find((element) => element.classes.has("task-hub-detail-extra"));
    const toggle = collect(container).find((element) => element.classes.has("task-hub-detail-extra-toggle"));
    const recurrence = collect(extra!).find((element) => element.classes.has("task-hub-recurrence-select"));
    const notes = collect(extra!).find((element) => element.type === "textarea");

    expect(extra?.classes.has("is-hidden")).toBe(true);
    expect(textValues(container)).not.toContain("Original notes");

    toggle!.checked = true;
    toggle!.dispatch("change");
    expect(extra?.classes.has("is-hidden")).toBe(false);

    recurrence!.value = "RRULE:FREQ=MONTHLY";
    recurrence!.change();
    notes!.value = "Updated notes";
    notes!.input();
    leaveTaskDetailEditor(container);

    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, expect.objectContaining({
      notes: "Updated notes",
      recurrence: "RRULE:FREQ=MONTHLY"
    }));
  });

  it("edits Apple Reminder alert settings from the task details pane only when a time exists", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, scheduledDate: "2026-05-08T09:30", alertMinutesBefore: 15 };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const time = collect(container).find((element) => element.type === "time");
    const alertSelect = collect(container).find((element) => element.classes.has("task-hub-reminder-alert-select"));
    expect(time?.value).toBe("09:30");
    expect(collect(container).find((element) => element.classes.has("task-hub-reminder-alert-toggle"))).toBeUndefined();
    expect(alertSelect?.value).toBe("15");
    expect(alertSelect?.disabled).toBe(false);

    alertSelect!.value = "30";
    alertSelect!.change();
    leaveTaskDetailEditor(container);
    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, expect.objectContaining({ startTime: "09:30", alertMinutesBefore: 30 }));

    const noTimeContainer = new FakeElement();
    renderTasksView(
      noTimeContainer as unknown as HTMLElement,
      [{ ...baseTask, scheduledDate: undefined, alertMinutesBefore: 15 }],
      [{ ...baseTask, scheduledDate: undefined, alertMinutesBefore: 15 }],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const noTime = collect(noTimeContainer).find((element) => element.type === "time");
    const noTimeAlertSelect = collect(noTimeContainer).find((element) => element.classes.has("task-hub-reminder-alert-select"));
    expect(noTimeAlertSelect?.value).toBe("15");
    noTimeAlertSelect!.value = "0";
    noTimeAlertSelect!.change();
    expect(noTime?.value).toBe("09:00");
    noTimeAlertSelect!.value = "";
    noTimeAlertSelect!.change();
    expect(noTime?.value).toBe("09:00");
    expect(collect(noTimeContainer).some((element) => element.text === "设置时间后可提醒")).toBe(false);
  });

  it("renders Apple Reminder tags as editable chips after input is committed", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, tags: ["#home"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    expect(editor).toBeDefined();
    expect(editor?.type).not.toBe("input");
    expect(editor?.attrs.get("role")).toBe("textbox");
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home"]);

    input!.value = "#errand";
    input!.dispatch("keydown", { key: " " });

    expect(input!.value).toBe("");
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#errand"]);
    collect(editor!).find((element) => element.classes.has("task-hub-tag-editor-chip") && element.text === "#home")!.click();
    expect(collect(editor!).find((element) => element.classes.has("is-selected"))?.text).toBe("#home");
    input!.dispatch("keydown", { key: "Backspace" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#errand"]);
    leaveTaskDetailEditor(container);
    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tags: ["#errand"] }));
  });

  it("does not commit partial pinyin tag text while IME composition is active", () => {
    const container = new FakeElement();
    const task = { ...baseTask, tags: ["#home"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));

    input!.dispatch("compositionstart");
    input!.value = "#bi ";
    input!.input();

    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home"]);

    input!.value = "#比赛 ";
    input!.dispatch("compositionend");

    expect(input!.value).toBe("");
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#比赛"]);
  });

  it("allows keyboard selection and deletion of earlier tag chips", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, tags: ["#home", "#errand", "#比赛"] };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    input!.focus();
    input!.selectionStart = 0;
    input!.selectionEnd = 0;

    input!.dispatch("keydown", { key: "ArrowLeft" });
    expect(input!.focused).toBe(false);
    expect(collect(editor!).find((element) => element.classes.has("is-selected") && element.focused)?.text).toBe("#比赛");
    collect(editor!).find((element) => element.classes.has("is-selected"))!.dispatch("keydown", { key: "ArrowLeft" });
    expect(collect(editor!).find((element) => element.classes.has("is-selected"))?.text).toBe("#errand");
    expect(collect(editor!).find((element) => element.classes.has("is-selected") && element.focused)?.text).toBe("#errand");
    expect(editor!.children.map((child) => child.classes.has("task-hub-tag-editor-input") ? "input" : child.text)).toEqual([
      "#home",
      "#errand",
      "#比赛",
      "input"
    ]);

    collect(editor!).find((element) => element.classes.has("is-selected"))!.dispatch("keydown", { key: "Backspace" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#比赛"]);

    collect(editor!).find((element) => element.classes.has("is-selected"))!.dispatch("keydown", { key: "ArrowLeft" });
    expect(collect(editor!).find((element) => element.classes.has("is-selected"))?.text).toBe("#home");
    collect(editor!).find((element) => element.classes.has("is-selected"))!.dispatch("keydown", { key: "Delete" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#比赛"]);

    leaveTaskDetailEditor(container);
    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tags: ["#比赛"] }));
  });

  it("binds native Obsidian tag suggestions while editing Apple Reminder tags", () => {
    const container = new FakeElement();
    const task = { ...baseTask, tags: [] };
    const bindTagInputSuggest = jest.fn();

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        bindTagInputSuggest
      }
    );

    const tags = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const title = collect(container).find((element) => element.classes.has("task-hub-detail-title-input"));
    const placeholder = collect(container).find((element) => element.classes.has("task-hub-tag-editor-placeholder"));

    expect(bindTagInputSuggest).toHaveBeenCalledWith(title);
    expect(bindTagInputSuggest).toHaveBeenCalledWith(tags);
    expect(placeholder?.parent?.classes.has("is-empty")).toBe(true);
    expect(placeholder?.text).toBe("tagPlaceholder");
  });

  it("opens the native date picker when the Apple Reminder date field is clicked", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const date = collect(container).find((element) => element.type === "date");
    date!.click();

    expect(date?.showPicker).toHaveBeenCalled();
  });

  it("keeps external task completion in the title row and removes the save action", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const actions = collect(container).find((element) => element.classes.has("task-hub-detail-actions"));
    const actionTexts = actions ? collect(actions).map((element) => element.text).filter(Boolean) : [];
    const checkbox = collect(container).find((element) => element.classes.has("task-hub-detail-complete-checkbox"));

    expect(actions).toBeUndefined();
    expect(actionTexts).toEqual([]);
    expect(findElementByText(container, "save")).toBeUndefined();
    expect(checkbox?.type).toBe("checkbox");
  });

  it("preserves an Apple Reminder start time when saving task detail edits", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = { ...baseTask, scheduledDate: "2026-05-08T09:30" };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const titleInput = collect(container).find((element) => element.classes.has("task-hub-detail-title-input"))!;
    titleInput.value = "Buy oat milk";
    titleInput.input();
    leaveTaskDetailEditor(container);

    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, expect.objectContaining({
      startTime: "09:30"
    }));
  });

  it("renders escaped Markdown punctuation in task titles as plain text", () => {
    const container = new FakeElement();
    const task = { ...baseTask, text: "5 号楼缺少空调 \\* 3" };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(collect(container).some((element) => element.classes.has("task-hub-task-text") && element.text === "5 号楼缺少空调 * 3")).toBe(true);
  });

  it("marks completed task rows for completed styling", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [{ ...baseTask, completed: true }],
      [{ ...baseTask, completed: true }],
      { status: "all", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(collect(container).some((element) => element.classes.has("task-hub-task-row") && element.classes.has("is-completed"))).toBe(true);
  });

  it("keeps task list cards free of context preview while editable details hide notes by default", () => {
    const container = new FakeElement();
    const task = { ...baseTask, contextPreview: "Context line that should only appear in details" };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const elements = collect(container);
    const extra = elements.find((element) => element.classes.has("task-hub-detail-extra"));
    expect(elements.some((element) => element.classes.has("task-hub-task-preview"))).toBe(false);
    expect(elements.some((element) => element.classes.has("task-hub-detail-context") && element.text === task.contextPreview)).toBe(false);
    expect(extra?.classes.has("is-hidden")).toBe(true);
    expect(collect(extra!).find((element) => element.type === "textarea")?.value).toBe(task.contextPreview);
  });

  it("keeps source file and vault context inside the hidden edit details section", () => {
    const container = new FakeElement();
    const task = {
      ...baseTask,
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      heading: "Project A",
      rawLine: "- [ ] Prototype",
      source: "vault" as const,
      contextPreview: "- [x] 原型开发 📅 2026-05-19 #p/天香居"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key
    );

    const extra = collect(container).find((element) => element.classes.has("task-hub-detail-extra"));
    const source = collect(container).find((element) => element.classes.has("task-hub-detail-source-file"));
    const context = collect(container).find((element) => element.classes.has("task-hub-detail-context"));

    expect(extra?.classes.has("is-hidden")).toBe(true);
    expect(source?.text).toBe("Project A");
    expect(context?.text).toBe(task.contextPreview);
    expect(source?.parent?.parent?.parent).toBe(extra);
    expect(context?.parent?.parent?.parent).toBe(extra);
  });

  it("keeps task filters visible when active filters match no tasks", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [],
      [baseTask],
      { status: "open", tags: ["#missing"], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-task-workbench"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-task-sidebar"))).toBe(false);
    expect(elements.some((element) => element.classes.has("task-hub-task-list-pane"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-task-details"))).toBe(false);
    expect(elements.some((element) => element.classes.has("task-hub-empty") && element.text === "noMatchingTasks")).toBe(true);
  });

  it("restores the task list scroll position after rendering", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, taskListScrollTop: 320 }
    );

    const list = collect(container).find((element) => element.classes.has("task-hub-task-list-pane"));

    expect(list?.scrollTop).toBe(320);
  });

  it("selects a task in place without rebuilding the task list", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const firstTask = { ...baseTask, id: "first", text: "First" };
    const secondTask = { ...baseTask, id: "second", text: "Second" };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask],
      [firstTask, secondTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, selectedTaskId: "first" }
    );

    const list = collect(container).find((element) => element.classes.has("task-hub-task-list-pane"));
    const originalListChildren = list?.children;
    const firstRow = collect(container).find((element) => element.classes.has("task-hub-task-row") && collect(element).some((child) => child.text === "First"));
    const secondRow = collect(container).find((element) => element.classes.has("task-hub-task-row") && collect(element).some((child) => child.text === "Second"));

    list!.scrollTop = 240;
    secondRow!.click();

    expect(list?.children).toBe(originalListChildren);
    expect(list?.scrollTop).toBe(240);
    expect(firstRow?.classes.has("is-selected")).toBe(false);
    expect(secondRow?.classes.has("is-selected")).toBe(true);
    expect(viewHandlers.onSelect).toHaveBeenCalledWith(secondTask, {
      additive: false,
      selectedTaskIds: ["second"]
    });
    expect(collect(container).some((element) => element.classes.has("task-hub-detail-title-input") && element.value === "Second")).toBe(true);
  });

  it("marks a task row as completing before calling the completion handler", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    const checkbox = findCheckbox(container);

    checkbox!.click();

    expect(row?.classes.has("is-completing")).toBe(true);
    expect(viewHandlers.onComplete).toHaveBeenCalledWith(baseTask);
  });

  it("keeps completed overdue tasks in other completed while current completed tasks stay in date sections", () => {
    const container = new FakeElement();
    const doneOverdue = { ...baseTask, id: "done-overdue", text: "Done overdue", completed: true, dueDate: "2026-05-01" };
    const openOverdue = { ...baseTask, id: "open-overdue", text: "Open overdue", dueDate: "2026-05-01" };
    const doneToday = { ...baseTask, id: "done-today", text: "Done today", completed: true, dueDate: "2026-05-08" };
    const doneTomorrow = { ...baseTask, id: "done-tomorrow", text: "Done tomorrow", completed: true, dueDate: "2026-05-09" };

    renderTasksView(
      container as unknown as HTMLElement,
      [doneOverdue, openOverdue, doneToday, doneTomorrow],
      [doneOverdue, openOverdue, doneToday, doneTomorrow],
      { status: "all", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const sections = collect(container).filter((element) => element.classes.has("task-hub-task-section"));
    const overdueSection = sections.find((section) => collect(section).some((element) => element.text === "overdue (1)"));
    const todaySection = sections.find((section) => collect(section).some((element) => element.text === "today (1)"));
    const tomorrowSection = sections.find((section) => collect(section).some((element) => element.text === "tomorrow (1)"));
    const completedSection = sections.find((section) => collect(section).some((element) => element.text === "otherCompleted (1)"));

    expect(collect(overdueSection as FakeElement).some((element) => element.text === "Open overdue")).toBe(true);
    expect(collect(overdueSection as FakeElement).some((element) => element.text === "Done overdue")).toBe(false);
    expect(collect(todaySection as FakeElement).some((element) => element.text === "Done today")).toBe(true);
    expect(collect(tomorrowSection as FakeElement).some((element) => element.text === "Done tomorrow")).toBe(true);
    expect(collect(completedSection as FakeElement).some((element) => element.text === "Done overdue")).toBe(true);
  });

  it("marks hidden completed tasks as exiting while they are kept for animation", () => {
    const container = new FakeElement();
    const completedTask = { ...baseTask, completed: true };

    renderTasksView(
      container as unknown as HTMLElement,
      [completedTask],
      [completedTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, exitingTaskIds: new Set([completedTask.id]) }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    expect(row?.classes.has("is-completed")).toBe(true);
    expect(row?.classes.has("is-exiting")).toBe(true);
  });

  it("does not render the old source filter sidebar in the task workbench", () => {
    const container = new FakeElement();
    const vaultTask = { ...baseTask, id: "vault-1", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };
    const appleTask = { ...baseTask, id: "apple-1", source: "apple-reminders" as const };

    renderTasksView(
      container as unknown as HTMLElement,
      [appleTask],
      [vaultTask, appleTask],
      { status: "open", tags: [], sourceQuery: "apple-reminders", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(collect(container).some((element) => element.classes.has("task-hub-task-sidebar"))).toBe(false);
    expect(textValues(container)).not.toContain("vaultTasks");
  });

  it("selects the first open task when completed tasks arrive first", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [
        { ...baseTask, id: "done-first", text: "Done first", completed: true },
        { ...baseTask, id: "open-second", text: "Open second", completed: false }
      ],
      [
        { ...baseTask, id: "done-first", text: "Done first", completed: true },
        { ...baseTask, id: "open-second", text: "Open second", completed: false }
      ],
      { status: "all", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(collect(container).some((element) => element.classes.has("task-hub-detail-title-input") && element.value === "Open second")).toBe(true);
  });

  it("toggles the selected vault task from the detail title checkbox", () => {
    const container = new FakeElement();
    const task = { ...baseTask, id: "vault-detail", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };
    const testHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      testHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const checkbox = collect(container).find((element) => element.classes.has("task-hub-detail-complete-checkbox"));
    checkbox?.change();

    expect(testHandlers.onComplete).toHaveBeenCalledWith(task);
    expect(findElementByText(container, "openSource")).toBeUndefined();
  });

  it("disables the detail title checkbox for read-only Apple Reminders tasks", () => {
    const container = new FakeElement();
    const testHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      testHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: false }
    );

    const checkbox = collect(container).find((element) => element.classes.has("task-hub-detail-complete-checkbox"));
    expect(checkbox?.disabled).toBe(true);
    expect(findElementByText(container, "openSource")).toBeUndefined();

    expect(testHandlers.onJump).not.toHaveBeenCalled();
  });

  it("does not render the Chinese open source action in the detail panel", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => (key === "openSource" ? "打开来源" : key),
      { allowAppleReminderWriteback: true }
    );

    expect(findElementByText(container, "打开来源")).toBeUndefined();
    expect(findElementByText(container, "打开源文件")).toBeUndefined();
  });

  it("renders a send target picker for vault tasks when creation is enabled", () => {
    const container = new FakeElement();
    const task = { ...baseTask, id: "vault-send", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };
    const testHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      testHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        allowAppleReminderCreate: true,
        allowDidaCreate: true,
        appleReminderLists: [{ id: "apple-list", name: "Inbox" }],
        didaProjects: [{ id: "dida-project", name: "Work" }],
        taskSendDefaultTarget: { type: "dida", projectId: "dida-project" }
      }
    );

    findElementByText(container, "sendTo")?.click();

    const actions = collect(container).find((element) => element.classes.has("task-hub-detail-actions"));
    const sendButton = findElementByText(container, "sendTo");
    const sendPicker = collect(container).find((element) => element.classes.has("task-hub-send-target-menu"));
    const sendLabel = collect(container).find((element) => element.classes.has("task-hub-send-target-label"));
    const sendIcon = collect(container).find((element) => element.classes.has("task-hub-send-target-icon"));
    expect(testHandlers.onSendToTarget).toHaveBeenCalledWith(task, { type: "dida", projectId: "dida-project" });
    expect(actions?.classes.has("has-send-action")).toBe(true);
    expect(actions?.classes.has("is-long-language")).toBe(true);
    expect(sendButton?.classes.has("mod-cta")).toBe(true);
    expect(sendButton?.parent?.classes.has("task-hub-send-label-cell")).toBe(true);
    expect(sendPicker).toBeDefined();
    expect(sendPicker?.parent?.classes.has("task-hub-send-picker-cell")).toBe(true);
    expect(sendLabel?.text).toBe("dida: Work");
    expect(sendIcon).toBeDefined();
  });

  it("sends to the selected target from the task details picker", () => {
    const container = new FakeElement();
    const task = { ...baseTask, id: "vault-send", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };
    const testHandlers = handlers();

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      testHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        allowAppleReminderCreate: true,
        allowDidaCreate: true,
        appleReminderLists: [{ id: "apple-list", name: "Inbox" }],
        didaProjects: [{ id: "dida-project", name: "Work" }]
      }
    );

    const didaOption = collect(container).find((element) => element.classes.has("task-hub-send-target-option") && element.text === "dida: Work");
    didaOption?.click();
    findElementByText(container, "sendTo")?.click();

    expect(testHandlers.onSendToTarget).toHaveBeenCalledWith(task, { type: "dida", projectId: "dida-project" });
  });

  it("keeps compact-language detail actions on the compact layout path", () => {
    const container = new FakeElement();
    const task = { ...baseTask, id: "vault-send", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      Object.assign((key: string) => key, { isCjk: true }),
      { allowAppleReminderWriteback: true, allowAppleReminderCreate: true, appleReminderLists: [{ id: "apple-list", name: "Inbox" }] }
    );

    const actions = collect(container).find((element) => element.classes.has("task-hub-detail-actions"));
    expect(actions?.classes.has("has-send-action")).toBe(true);
    expect(actions?.classes.has("is-compact-language")).toBe(true);
  });

  it("hides the Apple Reminders send action when creation is disabled", () => {
    const container = new FakeElement();
    const task = { ...baseTask, id: "vault-send", source: "vault" as const, filePath: "Project.md", externalSourceName: undefined };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, allowAppleReminderCreate: false }
    );

    expect(findElementByText(container, "sendTo")).toBeUndefined();
  });

});
