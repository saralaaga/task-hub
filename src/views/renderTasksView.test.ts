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

import { renderTasksView } from "./renderTasksView";
import type { TaskItem } from "../types";

const mockMenus: Array<{ items: Array<{ title: string; icon: string; click?: () => void }>; shownAt: unknown }> = [];

class FakeElement {
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
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

  empty(): void {
    this.children = [];
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = undefined;
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
    child.parent = this;
    this.children = this.children.filter((existing) => existing !== child);
    this.children.push(child);
    return child;
  }

  get parentElement(): FakeElement | undefined {
    return this.parent;
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
    for (const listener of this.listeners.get("focus") ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  }

  dispatch(name: string, eventOverrides: Partial<FakeEvent> = {}): FakeEvent {
    const event = { key: "", preventDefault: jest.fn(), stopPropagation: jest.fn(), ...eventOverrides };
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

function findElementByText(element: FakeElement, text: string): FakeElement | undefined {
  return collect(element).find((child) => child.text === text);
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
    mockMenus[0].items[0].click?.();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(row?.classes.has("is-selected")).toBe(true);
    expect(mockMenus[0].items[0].title).toBe("deleteCalendarItem");
    expect(mockMenus[0].items[0].icon).toBe("trash");
    expect(viewHandlers.onTaskDelete).toHaveBeenCalledWith(baseTask);
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
            title: "One",
            body: "Remember to attach the receipt. #比赛 #client/acme",
            tags: ["#比赛", "#client/acme"],
            createdAt: "2026-05-29T10:30:12"
          },
          {
            path: "Task Hub Notes/two.md",
            related: [],
            history: [],
            title: "Two",
            body: "Call vendor after payment.",
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
    expect(collect(container).find((element) => element.classes.has("task-hub-task-note-text"))?.text).toContain("Remember to attach");
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
            body: "测试一下 #标签",
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
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          }
        ]
      }
    );

    expect(renderNoteMarkdown).toHaveBeenCalledWith(expect.anything(), "- item one\n- item two", "Task Hub Notes/list.md");
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
    mockMenus[0].items[0].click?.();

    expect(mockMenus[0].items[0].title).toBe("createTaskNote");
    expect(mockMenus[0].items[0].icon).toBe("sticky-note");
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
    date!.value = "2026-05-09";
    tags!.value = "#errand #client-acme";
    findElementByText(container, "save")!.click();

    expect(viewHandlers.onTaskUpdate).toHaveBeenCalledWith(task, {
      kind: "task",
      title: "Buy oat milk",
      date: "2026-05-09",
      startTime: undefined,
      tags: ["#home", "#errand", "#client-acme"],
      reminderListId: undefined
    });
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
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home"]);

    input!.value = "#errand";
    input!.dispatch("keydown", { key: " " });

    expect(input!.value).toBe("");
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#errand"]);
    collect(editor!).find((element) => element.classes.has("task-hub-tag-editor-chip") && element.text === "#home")!.click();
    expect(collect(editor!).find((element) => element.classes.has("is-selected"))?.text).toBe("#home");
    input!.dispatch("keydown", { key: "Backspace" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#errand"]);
    findElementByText(container, "save")!.click();
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
    input!.selectionStart = 0;
    input!.selectionEnd = 0;

    input!.dispatch("keydown", { key: "ArrowLeft" });
    input!.dispatch("keydown", { key: "ArrowLeft" });
    expect(collect(editor!).find((element) => element.classes.has("is-selected"))?.text).toBe("#errand");
    expect(editor!.children.map((child) => child.classes.has("task-hub-tag-editor-input") ? "input" : child.text)).toEqual([
      "#home",
      "input",
      "#errand",
      "#比赛"
    ]);

    input!.dispatch("keydown", { key: "Backspace" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#比赛"]);

    input!.dispatch("keydown", { key: "ArrowLeft" });
    input!.dispatch("keydown", { key: "Backspace" });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#比赛"]);

    findElementByText(container, "save")!.click();
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

    expect(bindTagInputSuggest).toHaveBeenCalledWith(title);
    expect(bindTagInputSuggest).toHaveBeenCalledWith(tags);
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

  it("keeps the Apple Reminder save button in the same action row as the detail buttons", () => {
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

    expect(actions?.classes.has("has-three-actions")).toBe(true);
    expect(actionTexts).toEqual(["save", "markComplete", "openSource"]);
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

    collect(container).find((element) => element.classes.has("task-hub-detail-title-input"))!.value = "Buy oat milk";
    findElementByText(container, "save")!.click();

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

  it("keeps task list cards free of context preview while details show context", () => {
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
    expect(elements.some((element) => element.classes.has("task-hub-task-preview"))).toBe(false);
    expect(elements.some((element) => element.classes.has("task-hub-detail-context") && element.text === task.contextPreview)).toBe(true);
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
    expect(viewHandlers.onSelect).toHaveBeenCalledWith(secondTask);
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

  it("opens the selected vault task from the detail panel", () => {
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

    findElementByText(container, "openSource")?.click();

    expect(testHandlers.onJump).toHaveBeenCalledWith(task);
  });

  it("opens the selected Apple Reminders task from the detail panel", () => {
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

    const openButton = findElementByText(container, "openSource");
    expect(openButton?.disabled).toBe(false);
    openButton?.click();

    expect(testHandlers.onJump).toHaveBeenCalledWith(baseTask);
  });

  it("renders the Chinese open source action as open origin", () => {
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

    expect(findElementByText(container, "打开来源")).toBeDefined();
    expect(findElementByText(container, "打开源文件")).toBeUndefined();
  });

  it("renders an Apple Reminders send action for vault tasks when creation is enabled", () => {
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
      { allowAppleReminderWriteback: true, allowAppleReminderCreate: true }
    );

    findElementByText(container, "sendToAppleReminders")?.click();

    const actions = collect(container).find((element) => element.classes.has("task-hub-detail-actions"));
    const sendButton = findElementByText(container, "sendToAppleReminders");
    expect(testHandlers.onSendToAppleReminders).toHaveBeenCalledWith(task);
    expect(actions?.classes.has("has-three-actions")).toBe(true);
    expect(actions?.classes.has("is-long-language")).toBe(true);
    expect(sendButton?.classes.has("mod-cta")).toBe(true);
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
      (key) => (key === "language" ? "语言" : key),
      { allowAppleReminderWriteback: true, allowAppleReminderCreate: true }
    );

    const actions = collect(container).find((element) => element.classes.has("task-hub-detail-actions"));
    expect(actions?.classes.has("has-three-actions")).toBe(true);
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

    expect(findElementByText(container, "sendToAppleReminders")).toBeUndefined();
  });

});
