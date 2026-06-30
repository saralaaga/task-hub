jest.mock("obsidian", () => ({
  setIcon: jest.fn(),
  Notice: jest.fn(),
  Menu: class {
    items: Array<{ title: string; icon: string | null; disabled?: boolean; click?: (event?: Partial<FakeEvent>) => void }> = [];
    separators = 0;
    shownAt: unknown;

    constructor() {
      mockMenus.push(this);
    }

    addItem(build: (item: { setTitle(title: string | DocumentFragment): unknown; setIcon(icon: string | null): unknown; setDisabled(disabled: boolean): unknown; onClick(click: (event?: Partial<FakeEvent>) => void): unknown }) => void): void {
      const item = {
        title: "",
        icon: "" as string | null,
        disabled: undefined as boolean | undefined,
        click: undefined as ((event?: Partial<FakeEvent>) => void) | undefined,
        setTitle(title: string | DocumentFragment) {
          this.title = typeof title === "string" ? title : fragmentText(title);
          return this;
        },
        setIcon(icon: string | null) {
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

    addSeparator(): void {
      this.separators += 1;
    }

    showAtMouseEvent(event: unknown): void {
      this.shownAt = event;
    }

    showAtPosition(position: unknown): void {
    }
  }
}), { virtual: true });

import { renderTasksView } from "./renderTasksView";
import type { TaskHubSmartList, TaskItem } from "../types";

const mockMenus: Array<{
  items: Array<{ title: string; icon: string | null; disabled?: boolean; click?: (event?: Partial<FakeEvent>) => void }>;
  separators: number;
  shownAt: unknown;
}> = [];
const fakeWindow = {
  matchMedia: undefined as ((query: string) => MediaQueryList) | undefined
};

class FakeDocumentFragment {
  parts: string[] = [];

  appendChild(child: { textContent?: string; text?: string }): void {
    this.parts.push(child.textContent ?? child.text ?? "");
  }
}

const fakeDocument = {
  body: undefined as unknown as FakeElement,
  createDocumentFragment: () => new FakeDocumentFragment(),
  createElement: () => ({
    className: "",
    textContent: "● ",
    setCssProps: jest.fn()
  }),
  createTextNode: (text: string) => ({ textContent: text }),
  querySelector(selector: string): FakeElement | null {
    return this.body?.querySelector(selector) ?? null;
  }
};

function fragmentText(fragment: DocumentFragment): string {
  return (fragment as unknown as FakeDocumentFragment).parts?.join("") ?? "";
}

(globalThis as unknown as {
  document: {
    createDocumentFragment(): FakeDocumentFragment;
    createElement(tag: string): { className: string; textContent: string; setCssProps(props: Record<string, string>): void };
    createTextNode(text: string): { textContent: string };
  };
}).document = fakeDocument;

class FakeElement {
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
  draggable = false;
  open = false;
  text = "";
  type = "";
  value = "";
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  parent?: FakeElement;
  focused = false;
  scrollTop = 0;
  clientY = 0;
  clientX = 0;
  classes = new Set<string>();
  style = { setProperty: jest.fn() };
  showPicker = jest.fn();
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  get win(): Window {
    return fakeWindow as unknown as Window;
  }

  get doc(): Document {
    return fakeDocument as unknown as Document;
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
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      child.attrs.set(name, value);
    }
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

  querySelector(selector: string): FakeElement | null {
    if (!selector.startsWith(".")) return null;
    const classes = selector.split(".").filter(Boolean);
    return collect(this).find((element) => classes.every((cls) => element.classes.has(cls))) ?? null;
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

  getBoundingClientRect(): { top: number; height: number } {
    const style = this.style as { left?: string; top?: string };
    const parentRect = this.parent?.getBoundingClientRect() as ({ top: number; right?: number; left?: number } | undefined);
    const left = Number.parseFloat(style.left ?? "") || this.clientX || parentRect?.left || 0;
    const top = Number.parseFloat(style.top ?? "") || this.clientY || parentRect?.top || 0;
    return { left, top, right: left + 150, height: 40 } as { left: number; top: number; height: number; right: number };
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

fakeDocument.body = new FakeElement();

type FakeEvent = {
  key: string;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  clientX?: number;
  clientY?: number;
  dataTransfer?: {
    effectAllowed?: string;
    dropEffect?: string;
    setData(type: string, value: string): void;
    getData(type: string): string;
  };
  target?: FakeElement;
  stopped?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
};

const baseTask: TaskItem = {
  id: "apple-reminders:1",
  stableId: "apple-reminders:1",
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

function fakeDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: "",
    dropEffect: "",
    setData(type: string, value: string) {
      store.set(type, value);
    },
    getData(type: string) {
      return store.get(type) ?? "";
    }
  };
}

function smartListTranslator(key: string): string {
  return ({
    smartListDragInNotice: "已将 {count} 个任务拖入「{name}」。",
    smartListDragOutNotice: "已从「{name}」拖出 {count} 个任务。",
    smartListDragStartNotice: "从「{name}」智能列表中拖动 {count} 个任务。"
  }[key] ?? key);
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

function taskRowByTitle(container: FakeElement, title: string): FakeElement | undefined {
  return collect(container)
    .filter((element) => element.classes.has("task-hub-task-row"))
    .find((row) => taskRowTitle(row) === title);
}

function taskNoteCardByTitle(container: FakeElement, title: string): FakeElement | undefined {
  return collect(container)
    .filter((element) => element.classes.has("task-hub-task-note-card"))
    .find((card) => collect(card).find((element) => element.classes.has("task-hub-task-note-title"))?.text === title);
}

function taskNotePinButtonByTitle(container: FakeElement, title: string): FakeElement | undefined {
  return collect(taskNoteCardByTitle(container, title) ?? container).find((element) => element.classes.has("task-hub-task-note-pin"));
}

function firstProgressValue(element: FakeElement): string | undefined {
  return collect(element).find((child) => child.classes.has("task-hub-task-progress-value"))?.text;
}

function firstProgressFill(element: FakeElement): FakeElement | undefined {
  return collect(element).find((child) => child.classes.has("task-hub-task-progress-fill"));
}

function inlineStyleWidth(element: FakeElement | undefined): string | undefined {
  return (element?.style as { width?: string } | undefined)?.width;
}

describe("renderTasksView", () => {
  beforeEach(() => {
    mockMenus.length = 0;
    fakeDocument.body.empty();
    const { Notice } = jest.requireMock("obsidian") as { Notice: jest.Mock };
    Notice.mockClear();
  });

  const handlers = () => ({
    onComplete: jest.fn(),
    onJump: jest.fn(),
    onTaskReschedule: jest.fn(),
    onTaskReorder: jest.fn(),
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
    onOpenTaskNoteSource: jest.fn(),
    onOpenTaskNoteInThino: jest.fn(),
    onTaskNoteReorder: jest.fn(),
    onToggleTaskNotePinned: jest.fn()
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

  it("opens an inline smart list name form before saving a smart list", () => {
    const container = new FakeElement();
    const onSaveSmartList = jest.fn();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: false, smartLists: [], onSaveSmartList }
    );

    const add = collect(container).find((element) => element.attrs.get("aria-label") === "saveSmartList");
    expect(add).toBeDefined();
    expect(add!.attrs.has("title")).toBe(false);
    add!.click();

    const input = collect(container).find((element) => element.classes.has("task-hub-smart-list-name-input"));
    expect(input).toBeDefined();
    input!.value = "Focus";
    input!.input();
    const save = collect(container).find((element) => element.classes.has("task-hub-smart-list-create-save"));
    expect(save).toBeDefined();
    save!.click();

    expect(onSaveSmartList).toHaveBeenCalledWith("Focus");
  });

  it("uses a context menu for smart list color and deletion instead of an inline delete button", () => {
    const container = new FakeElement();
    const onApplySmartList = jest.fn();
    const onDeleteSmartList = jest.fn();
    const onSmartListColorChange = jest.fn();
    const onRenameSmartList = jest.fn();
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      color: "#6f94b8",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: ["vault:th_focus"],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: false,
        smartLists: [smartList],
        activeSmartListId: "focus",
        onApplySmartList,
        onDeleteSmartList,
        onRenameSmartList,
        onSmartListColorChange
      }
    );

    const item = collect(container).find((element) => element.classes.has("task-hub-smart-list-item"));
    const apply = collect(container).find((element) => element.classes.has("task-hub-smart-list-apply"));
    expect(item?.style.setProperty).toHaveBeenCalledWith("--task-hub-smart-list-color", "#6f94b8");
    expect(collect(container).some((element) => element.classes.has("task-hub-smart-list-delete"))).toBe(false);

    apply!.click();
    expect(onApplySmartList).toHaveBeenCalledWith(smartList);

    item!.clientX = 420;
    item!.clientY = 150;
    item!.dispatch("contextmenu", { clientX: 120, clientY: 48 });
    expect(mockMenus.length).toBe(0);
    const menu = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-smart-list-context-menu"));
    expect(menu).toBeDefined();
    expect(menu?.classes.has("menu")).toBe(true);
    expect(menu?.parent).toBe(fakeDocument.body);
    expect((menu?.style as { left?: string }).left).toBe("120px");
    expect((menu?.style as { top?: string }).top).toBe("48px");
    const contextActions = collect(menu!).filter((element) => element.classes.has("task-hub-smart-list-context-action"));
    expect(textValues(menu!)).toEqual(expect.arrayContaining(["smartListColor", ">", "renameSmartList", "deleteSmartList"]));
    expect(contextActions).toHaveLength(3);
    expect(contextActions.every((element) => element.classes.has("menu-item"))).toBe(true);
    expect(collect(menu!).some((element) => element.classes.has("menu-separator"))).toBe(true);
    const colorSubmenu = collect(menu!).find((element) => element.classes.has("task-hub-smart-list-color-submenu"));
    expect(colorSubmenu).toBeDefined();
    expect(colorSubmenu?.classes.has("menu")).toBe(true);
    expect(collect(colorSubmenu!).filter((element) => element.classes.has("task-hub-smart-list-menu-color-dot"))).toHaveLength(7);
    const blueColor = collect(colorSubmenu!).find((element) => element.classes.has("task-hub-smart-list-color-label") && element.text === "smartListColorBlue");
    expect(blueColor).toBeDefined();
    expect(collect(colorSubmenu!).some((element) => element.classes.has("task-hub-smart-list-color-check"))).toBe(true);
    expect((colorSubmenu?.style as { left?: string }).left).toBe("274px");
    expect((colorSubmenu?.style as { top?: string }).top).toBe("43px");

    const defaultColorAction = collect(colorSubmenu!).find((element) => {
      return element.classes.has("task-hub-smart-list-color-action") && collect(element).some((child) => child.text === "smartListColorDefault");
    });
    defaultColorAction!.click();
    const deleteAction = contextActions.find((element) => collect(element).some((child) => child.text === "deleteSmartList"));
    deleteAction!.click();

    expect(onSmartListColorChange).toHaveBeenCalledWith(smartList, undefined);
    expect(onDeleteSmartList).toHaveBeenCalledWith(smartList);
  });

  it("shows the runtime smart list task count when provided", () => {
    const container = new FakeElement();
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: false,
        smartLists: [smartList],
        smartListCounts: new Map([["focus", 7]])
      }
    );

    expect(collect(container).find((element) => element.classes.has("task-hub-smart-list-item-count"))?.text).toBe("7");
  });

  it("drops selected tasks onto a smart list", () => {
    const container = new FakeElement();
    const onAddTasksToSmartList = jest.fn();
    const firstTask: TaskItem = {
      ...baseTask,
      id: "first",
      stableId: "vault:th_first",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] First 📅 2026-05-08",
      text: "First",
      dueDate: "2026-05-08"
    };
    const secondTask: TaskItem = {
      ...firstTask,
      id: "second",
      stableId: "vault:th_second",
      rawLine: "- [ ] Second 📅 2026-05-09",
      text: "Second",
      dueDate: "2026-05-09"
    };
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask],
      [firstTask, secondTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      smartListTranslator,
      {
        allowAppleReminderWriteback: true,
        selectedTaskIds: new Set(["first", "second"]),
        smartLists: [smartList],
        onAddTasksToSmartList
      }
    );

    const dragRow = taskRowByTitle(container, "First");
    const smartListItem = collect(container).find((element) => element.classes.has("task-hub-smart-list-item"));
    const dataTransfer = fakeDataTransfer();

    dragRow?.dispatch("dragstart", { dataTransfer });
    const dragover = smartListItem?.dispatch("dragover", { dataTransfer });
    smartListItem?.dispatch("drop", { dataTransfer });

    expect(dragover?.preventDefault).toHaveBeenCalled();
    expect(onAddTasksToSmartList).toHaveBeenCalledWith(smartList, [firstTask, secondTask]);
  });

  it("uses the live command selection when batch dragging tasks onto a smart list", () => {
    const container = new FakeElement();
    const onAddTasksToSmartList = jest.fn();
    const firstTask: TaskItem = {
      ...baseTask,
      id: "first",
      stableId: "vault:th_first",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] First 📅 2026-05-08",
      text: "First",
      dueDate: "2026-05-08"
    };
    const secondTask: TaskItem = {
      ...firstTask,
      id: "second",
      stableId: "vault:th_second",
      rawLine: "- [ ] Second 📅 2026-05-09",
      text: "Second",
      dueDate: "2026-05-09"
    };
    const focusList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };
    const inboxList: TaskHubSmartList = { ...focusList, id: "inbox", name: "Inbox" };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask],
      [firstTask, secondTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      smartListTranslator,
      {
        allowAppleReminderWriteback: true,
        selectedTaskId: "first",
        smartLists: [focusList, inboxList],
        activeSmartListId: "focus",
        onAddTasksToSmartList
      }
    );

    const secondRow = taskRowByTitle(container, "Second");
    secondRow?.dispatch("click", { metaKey: true });
    const dragRow = taskRowByTitle(container, "First");
    const inboxItem = collect(container)
      .filter((element) => element.classes.has("task-hub-smart-list-item"))
      .find((element) => textValues(element).includes("Inbox"));
    const dataTransfer = fakeDataTransfer();

    dragRow?.dispatch("dragstart", { dataTransfer });
    expect(dragRow?.classes.has("is-dragging")).toBe(true);
    expect(secondRow?.classes.has("is-bulk-dragging")).toBe(true);
    inboxItem?.dispatch("drop", { dataTransfer });

    const { Notice } = jest.requireMock("obsidian") as { Notice: jest.Mock };
    expect(onAddTasksToSmartList).toHaveBeenCalledWith(inboxList, [firstTask, secondTask]);
    expect(Notice).toHaveBeenCalledWith("从「Focus」智能列表中拖动 2 个任务。");
    expect(Notice).toHaveBeenCalledWith("已将 2 个任务拖入「Inbox」。");
    expect(dragRow?.classes.has("is-dragging")).toBe(false);
    expect(secondRow?.classes.has("is-bulk-dragging")).toBe(false);
  });

  it("shows a trash drop target only for the active smart list view and removes selected tasks", () => {
    const container = new FakeElement();
    const onRemoveTasksFromActiveSmartList = jest.fn();
    const firstTask: TaskItem = {
      ...baseTask,
      id: "first",
      stableId: "vault:th_first",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] First 📅 2026-05-08",
      text: "First",
      dueDate: "2026-05-08"
    };
    const secondTask: TaskItem = {
      ...firstTask,
      id: "second",
      stableId: "vault:th_second",
      rawLine: "- [ ] Second 📅 2026-05-09",
      text: "Second",
      dueDate: "2026-05-09"
    };
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask],
      [firstTask, secondTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      smartListTranslator,
      {
        allowAppleReminderWriteback: true,
        selectedTaskIds: new Set(["first", "second"]),
        smartLists: [smartList],
        activeSmartListId: "focus",
        onRemoveTasksFromActiveSmartList
      }
    );

    const remove = collect(container).find((element) => element.classes.has("task-hub-smart-list-remove-drop"));
    expect(remove).toBeDefined();
    expect(remove?.type).not.toBe("button");
    expect(remove?.attrs.get("role")).toBe("button");
    expect(remove?.attrs.get("aria-label")).toBe("removeFromSmartListHint");
    remove!.click();
    const { Notice } = jest.requireMock("obsidian") as { Notice: jest.Mock };
    expect(Notice).toHaveBeenCalledWith("removeFromSmartListHint");

    const dragRow = taskRowByTitle(container, "First");
    const dataTransfer = fakeDataTransfer();
    dragRow?.dispatch("dragstart", { dataTransfer });
    const dragover = remove?.dispatch("dragover", { dataTransfer });
    remove?.dispatch("drop", { dataTransfer });

    expect(dragover?.preventDefault).toHaveBeenCalled();
    expect(onRemoveTasksFromActiveSmartList).toHaveBeenCalledWith([firstTask, secondTask]);
    expect(Notice).toHaveBeenCalledWith("已从「Focus」拖出 2 个任务。");
  });

  it("renames a smart list inline from its context menu on enter or blur", () => {
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    const render = () => {
      const container = new FakeElement();
      const onRenameSmartList = jest.fn();
      renderTasksView(
        container as unknown as HTMLElement,
        [baseTask],
        [baseTask],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        {
          allowAppleReminderWriteback: false,
          smartLists: [smartList],
          onRenameSmartList
        }
      );
      const item = collect(container).find((element) => element.classes.has("task-hub-smart-list-item"));
      item!.dispatch("contextmenu", { clientX: 120, clientY: 48 });
      const menu = collect(fakeDocument.body).find((element) => element.classes.has("task-hub-smart-list-context-menu"));
      const renameAction = collect(menu!).find((element) => element.classes.has("task-hub-smart-list-context-action") && collect(element).some((child) => child.text === "renameSmartList"));
      renameAction!.click();
      const input = collect(item!).find((element) => element.classes.has("task-hub-smart-list-rename-input"));
      return { input, onRenameSmartList };
    };

    const enterCase = render();
    expect(enterCase.input).toBeDefined();
    expect(enterCase.input!.value).toBe("Focus");
    expect(enterCase.input!.focused).toBe(true);
    enterCase.input!.value = "Deep work";
    enterCase.input!.dispatchSelf("keydown", { key: "Enter" });
    expect(enterCase.onRenameSmartList).toHaveBeenCalledWith(smartList, "Deep work");

    const blurCase = render();
    blurCase.input!.value = "Later";
    blurCase.input!.dispatchSelf("blur");
    expect(blurCase.onRenameSmartList).toHaveBeenCalledWith(smartList, "Later");
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
      {
        allowAppleReminderWriteback: true,
        expandedTaskIds: new Set(["parent"]),
        expandingTaskIds: new Set(["parent"]),
        onToggleTaskExpanded
      }
    );

    const rows = collect(container).filter((element) => element.classes.has("task-hub-task-row"));
    const subtaskList = collect(container).find((element) => element.classes.has("task-hub-subtask-list"));
    expect(rows.map(taskRowTitle)).toEqual(["Parent", "Child"]);
    expect(rows[1].attrs.get("data-task-depth")).toBe("1");
    expect(subtaskList?.classes.has("is-opening")).toBe(true);
  });

  it("does not replay the subtask enter animation on ordinary rerenders", () => {
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

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, child],
      [parent, child],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, expandedTaskIds: new Set(["parent"]) }
    );

    const subtaskList = collect(container).find((element) => element.classes.has("task-hub-subtask-list"));
    expect(subtaskList?.classes.has("is-opening")).toBe(false);
  });

  it("renders recursive progress bars for parent tasks and task details", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Parent",
      text: "Parent"
    };
    const nestedParent: TaskItem = {
      ...parent,
      id: "nested-parent",
      line: 1,
      rawLine: "  - [ ] Nested parent",
      text: "Nested parent",
      indent: 1,
      parentId: "parent"
    };
    const nestedDone: TaskItem = {
      ...parent,
      id: "nested-done",
      line: 2,
      rawLine: "    - [x] Nested done",
      text: "Nested done",
      completed: true,
      dueDate: undefined,
      indent: 2,
      parentId: "nested-parent"
    };
    const nestedOpen: TaskItem = {
      ...nestedDone,
      id: "nested-open",
      line: 3,
      rawLine: "    - [ ] Nested open",
      text: "Nested open",
      completed: false
    };
    const leafOpen: TaskItem = {
      ...parent,
      id: "leaf-open",
      line: 4,
      rawLine: "  - [ ] Leaf open",
      text: "Leaf open",
      dueDate: undefined,
      indent: 1,
      parentId: "parent"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, nestedParent, nestedDone, nestedOpen, leafOpen],
      [parent, nestedParent, nestedDone, nestedOpen, leafOpen],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, expandedTaskIds: new Set(["parent", "nested-parent"]) }
    );

    expect(firstProgressValue(taskRowByTitle(container, "Parent")!)).toBe("25%");
    expect(firstProgressValue(taskRowByTitle(container, "Nested parent")!)).toBe("50%");
    expect(collect(container).find((element) => element.classes.has("task-hub-detail-progress"))).toBeUndefined();
    expect(textValues(container)).not.toContain("subtaskProgressTreeHint");
  });

  it("places parent progress bars on the same row content lane instead of under the title block", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
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

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, child],
      [parent, child],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const row = taskRowByTitle(container, "Parent")!;
    const content = collect(row).find((element) => element.classes.has("task-hub-task-content"));
    const body = collect(row).find((element) => element.classes.has("task-hub-task-body"));
    const progress = collect(row).find((element) => element.classes.has("task-hub-task-progress"));

    expect(row.classes.has("has-progress")).toBe(true);
    expect(content?.children.includes(body as FakeElement)).toBe(true);
    expect(content?.children.includes(progress as FakeElement)).toBe(true);
  });

  it("hides subtask progress bars when the setting is disabled", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Parent",
      text: "Parent"
    };
    const child: TaskItem = {
      ...parent,
      id: "child",
      line: 1,
      rawLine: "  - [x] Child",
      text: "Child",
      completed: true,
      dueDate: undefined,
      indent: 1,
      parentId: "parent"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [parent, child],
      [parent, child],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, showSubtaskProgressBars: false }
    );

    expect(collect(container).filter((element) => element.classes.has("task-hub-task-progress"))).toHaveLength(0);
    expect(collect(container).find((element) => element.classes.has("task-hub-detail-progress"))).toBeUndefined();
  });

  it("keeps parent progress based on the full task tree when hidden children are filtered out", () => {
    const container = new FakeElement();
    const parent: TaskItem = {
      ...baseTask,
      id: "parent",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Parent",
      text: "Parent",
      dueDate: undefined
    };
    const hiddenCompletedChild: TaskItem = {
      ...parent,
      id: "child",
      line: 1,
      rawLine: "  - [x] Child",
      text: "Child",
      completed: true,
      indent: 1,
      parentId: "parent"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [parent],
      [parent, hiddenCompletedChild],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    expect(firstProgressValue(taskRowByTitle(container, "Parent")!)).toBe("100%");
  });

  it("animates parent progress increases from the previous percentage on rerender", () => {
    jest.useFakeTimers();
    try {
      const container = new FakeElement();
      const parent: TaskItem = {
        ...baseTask,
        id: "parent",
        stableId: "vault:parent",
        source: "vault",
        externalId: undefined,
        externalSourceName: undefined,
        filePath: "Project.md",
        rawLine: "- [ ] Parent",
        text: "Parent",
        dueDate: undefined
      };
      const child: TaskItem = {
        ...parent,
        id: "child",
        stableId: "vault:child",
        line: 1,
        rawLine: "  - [ ] Child",
        text: "Child",
        indent: 1,
        parentId: "parent"
      };

      renderTasksView(
        container as unknown as HTMLElement,
        [parent, child],
        [parent, child],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        { allowAppleReminderWriteback: true }
      );

      const completedChild = { ...child, completed: true, rawLine: "  - [x] Child" };
      renderTasksView(
        container as unknown as HTMLElement,
        [parent, completedChild],
        [parent, completedChild],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        { allowAppleReminderWriteback: true }
      );

      const row = taskRowByTitle(container, "Parent")!;
      const progress = collect(row).find((element) => element.classes.has("task-hub-task-progress"));
      const fill = firstProgressFill(row);

      expect(progress?.classes.has("is-progress-animating")).toBe(true);
      expect(progress?.classes.has("is-progress-increasing")).toBe(true);
      expect(inlineStyleWidth(fill)).toBe("0%");

      jest.runOnlyPendingTimers();
      expect(inlineStyleWidth(fill)).toBe("100%");
    } finally {
      jest.useRealTimers();
    }
  });

  it("animates parent progress decreases from the previous percentage on rerender", () => {
    jest.useFakeTimers();
    try {
      const container = new FakeElement();
      const parent: TaskItem = {
        ...baseTask,
        id: "parent",
        stableId: "vault:parent",
        source: "vault",
        externalId: undefined,
        externalSourceName: undefined,
        filePath: "Project.md",
        rawLine: "- [ ] Parent",
        text: "Parent",
        dueDate: undefined
      };
      const child: TaskItem = {
        ...parent,
        id: "child",
        stableId: "vault:child",
        line: 1,
        rawLine: "  - [x] Child",
        text: "Child",
        completed: true,
        indent: 1,
        parentId: "parent"
      };

      renderTasksView(
        container as unknown as HTMLElement,
        [parent, child],
        [parent, child],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        { allowAppleReminderWriteback: true }
      );

      const reopenedChild = { ...child, completed: false, rawLine: "  - [ ] Child" };
      renderTasksView(
        container as unknown as HTMLElement,
        [parent, reopenedChild],
        [parent, reopenedChild],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        { allowAppleReminderWriteback: true }
      );

      const row = taskRowByTitle(container, "Parent")!;
      const progress = collect(row).find((element) => element.classes.has("task-hub-task-progress"));
      const fill = firstProgressFill(row);

      expect(progress?.classes.has("is-progress-animating")).toBe(true);
      expect(progress?.classes.has("is-progress-decreasing")).toBe(true);
      expect(inlineStyleWidth(fill)).toBe("100%");

      jest.runOnlyPendingTimers();
      expect(inlineStyleWidth(fill)).toBe("0%");
    } finally {
      jest.useRealTimers();
    }
  });

  it("animates subtask collapse before toggling the tree closed", () => {
    jest.useFakeTimers();
    try {
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
      const onToggleTaskExpanded = jest.fn();

      renderTasksView(
        container as unknown as HTMLElement,
        [parent, child],
        [parent, child],
        { status: "open", tags: [], sourceQuery: "", textQuery: "" },
        handlers(),
        new Date("2026-05-08T12:00:00Z"),
        (key) => key,
        { allowAppleReminderWriteback: true, expandedTaskIds: new Set(["parent"]), onToggleTaskExpanded }
      );

      const toggle = collect(container).find((element) => element.classes.has("task-hub-subtask-toggle"));
      const subtaskList = collect(container).find((element) => element.classes.has("task-hub-subtask-list"));
      toggle?.click();

      expect(onToggleTaskExpanded).not.toHaveBeenCalled();
      expect(subtaskList?.classes.has("is-closing")).toBe(true);

      jest.advanceTimersByTime(260);
      expect(onToggleTaskExpanded).toHaveBeenCalledWith(parent);
    } finally {
      jest.useRealTimers();
    }
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

    const row = collect(container).find((element) => element.classes.has("task-hub-task-row"));
    const chips = collect(row!).filter((element) => element.classes.has("task-hub-task-tag"));
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
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["delete", "edit", "taskNoteEditSource"]);
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    expect(viewHandlers.onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNoteSource).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("shows delete, edit, source edit, and Thino edit note menu actions", () => {
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
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual([
      "delete",
      "edit",
      "taskNoteEditSource",
      "taskNoteEditInThino"
    ]);
    mockMenus.at(-1)?.items[0].click?.();
    mockMenus.at(-1)?.items[1].click?.();
    mockMenus.at(-1)?.items[2].click?.();
    mockMenus.at(-1)?.items[3].click?.();
    expect(viewHandlers.onDeleteTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNote).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNoteSource).toHaveBeenCalledWith("Task Hub Notes/one.md");
    expect(viewHandlers.onOpenTaskNoteInThino).toHaveBeenCalledWith("Task Hub Notes/one.md");
  });

  it("makes multiple task note cards draggable and reports note reordering on drop", () => {
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
            noteId: "note-1",
            related: [],
            history: [],
            title: "One",
            body: "Body one",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          },
          {
            path: "Task Hub Notes/two.md",
            noteId: "note-2",
            related: [],
            history: [],
            title: "Two",
            body: "Body two",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-28T09:00:00"
          }
        ]
      }
    );

    const dragCard = taskNoteCardByTitle(container, "one");
    const dropCard = taskNoteCardByTitle(container, "two");
    const dataTransfer = fakeDataTransfer();

    expect(dragCard?.draggable).toBe(true);
    expect(dropCard?.draggable).toBe(true);
    dropCard!.clientY = 0;
    dragCard?.dispatch("dragstart", { dataTransfer });
    dropCard?.dispatch("drop", { dataTransfer, clientY: 28 });

    expect(viewHandlers.onTaskNoteReorder).toHaveBeenCalledWith(
      baseTask,
      expect.objectContaining({ noteId: "note-1", path: "Task Hub Notes/one.md" }),
      expect.objectContaining({ noteId: "note-2", path: "Task Hub Notes/two.md" }),
      "after"
    );
  });

  it("does not make a single task note draggable", () => {
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
            path: "Task Hub Notes/solo.md",
            noteId: "note-solo",
            related: [],
            history: [],
            title: "Solo",
            body: "Only one",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          }
        ]
      }
    );

    expect(taskNoteCardByTitle(container, "solo")?.draggable).toBe(false);
  });

  it("renders a pin button beside the note menu and toggles pinned state", () => {
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
        isTaskNotePinned: (_task, note) => note.path === "Task Hub Notes/two.md",
        getTaskNoteCount: () => 2,
        getTaskNotes: () => [
          {
            path: "Task Hub Notes/one.md",
            noteId: "note-1",
            related: [],
            history: [],
            title: "One",
            body: "Body one",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-29T10:30:12"
          },
          {
            path: "Task Hub Notes/two.md",
            noteId: "note-2",
            related: [],
            history: [],
            title: "Two",
            body: "Body two",
            bodyStartLine: 10,
            tags: [],
            createdAt: "2026-05-28T09:00:00"
          }
        ]
      }
    );

    const firstPin = taskNotePinButtonByTitle(container, "one");
    const secondCard = taskNoteCardByTitle(container, "two");

    expect(firstPin?.attrs.get("aria-label")).toBe("taskNotePin");
    expect(secondCard?.classes.has("is-pinned")).toBe(true);
    taskNotePinButtonByTitle(container, "one")?.click();
    expect(viewHandlers.onToggleTaskNotePinned).toHaveBeenCalledWith(
      baseTask,
      expect.objectContaining({ noteId: "note-1", path: "Task Hub Notes/one.md" })
    );
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
    expect(collect(editor!).find((element) => element.classes.has("task-hub-tag-editor-chip") && element.text === "#home")?.classes.has("task-hub-task-tag")).toBe(true);

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
    const header = collect(container).find((element) => element.classes.has("task-hub-detail-title-header"));
    const headerCheckbox = collect(header!).find((element) => element.classes.has("task-hub-detail-complete-checkbox"));
    const headerTitle = collect(header!).find((element) => element.text === "taskDetails");
    const headerLogo = collect(header!).find((element) => element.classes.has("task-hub-detail-source-logo"));
    const bodyLabel = collect(container).find((element) => element.classes.has("task-hub-detail-label") && element.text === "taskCreationBody");
    const bodyRow = bodyLabel?.parent;
    const editDetailsLabel = collect(container).find((element) => element.classes.has("task-hub-detail-label") && element.text === "editDetails");
    const editDetailsRow = editDetailsLabel?.parent;
    const recurrence = collect(extra!).find((element) => element.classes.has("task-hub-recurrence-select"));
    const notes = collect(extra!).find((element) => element.type === "textarea");

    expect(header?.children.map((child) => child.classes.has("task-hub-detail-icon-cell") ? "check-cell" : child.text || (child.classes.has("task-hub-detail-header-logo-cell") ? "logo-cell" : ""))).toEqual(["check-cell", "taskDetails", "logo-cell", ""]);
    expect(headerCheckbox?.parent?.classes.has("task-hub-detail-icon-cell")).toBe(true);
    expect(headerTitle).toBeDefined();
    expect(headerLogo?.parent?.classes.has("task-hub-detail-header-logo-cell")).toBe(true);
    expect(collect(bodyRow!).some((element) => element.classes.has("task-hub-detail-complete-checkbox"))).toBe(false);
    expect(toggle?.parent?.classes.has("task-hub-detail-icon-cell")).toBe(true);
    expect(editDetailsRow?.classes.has("task-hub-detail-toggle-row")).toBe(true);
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

  it("lets Apple Reminder tasks switch lists from the hidden detail section", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const task = {
      ...baseTask,
      externalListId: "inbox"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [task],
      [task],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        appleReminderLists: [
          { id: "inbox", name: "Inbox", sourceId: "icloud", sourceName: "iCloud" },
          { id: "work", name: "Work", sourceId: "icloud", sourceName: "iCloud" },
          { id: "local", name: "On My Mac", sourceId: "local", sourceName: "On My Mac" }
        ]
      }
    );

    const toggle = collect(container).find((element) => element.classes.has("task-hub-detail-extra-toggle"));
    const extra = collect(container).find((element) => element.classes.has("task-hub-detail-extra"));
    toggle!.checked = true;
    toggle!.dispatch("change");

    const listSelect = collect(extra!).find((element) => element.classes.has("task-hub-detail-list-select"));
    const optionLabels = collect(listSelect!).filter((element) => element.type === "option").map((element) => element.text);
    expect(textValues(container)).toContain("appleReminderList");
    expect(listSelect?.value).toBe("inbox");
    expect(optionLabels).toContain("Inbox");
    expect(optionLabels).toContain("Work");
    expect(optionLabels).toContain("On My Mac");

    listSelect!.value = "work";
    listSelect!.change();

    expect(viewHandlers.onAppleReminderListChange).toHaveBeenCalledWith(task, "work");
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

  it("renders the task detail body as an auto-growing multiline field", () => {
    const container = new FakeElement();
    const task = {
      ...baseTask,
      text: "也许将 taskhub 扩展为一个不错的完整任务管理插件，用任务驱动笔记系统会更顺手一些"
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

    const title = collect(container).find((element) => element.classes.has("task-hub-detail-title-input"));

    expect(title?.type).toBe("textarea");
    expect(title?.classes.has("task-hub-auto-grow-textarea")).toBe(true);
    expect(title?.value).toBe(task.text);
    expect(title?.attrs.get("rows")).toBe("1");
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

  it("keeps the filter sidebar visible when condition filters match no tasks", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [],
      [baseTask],
      {
        status: "open",
        tags: [],
        sourceQuery: "",
        textQuery: "",
        conditions: { operator: "and", tag: "#missing", dateBucket: "", text: "" }
      },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        filterHandlers: {
          onConditionChange: jest.fn(),
          onClearFilters: jest.fn(),
          onTagQueryChange: jest.fn(),
          onSourceFilterChange: jest.fn(),
          onTextQueryChange: jest.fn()
        }
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-task-workbench"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-task-filter-sidebar"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-task-list-pane"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-empty") && element.text === "noMatchingTasks")).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-empty") && element.text === "noOpenTasks")).toBe(false);
  });

  it("keeps the smart list sidebar visible when an active smart list has no tasks", () => {
    const container = new FakeElement();
    const smartList: TaskHubSmartList = {
      id: "empty",
      name: "Empty",
      filters: { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      taskStableIds: [],
      taskIds: [],
      createdAt: "2026-06-30T00:00:00.000Z",
      updatedAt: "2026-06-30T00:00:00.000Z"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        smartLists: [smartList],
        activeSmartListId: "empty"
      }
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-task-workbench"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-smart-list-card"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-smart-list-item") && element.classes.has("is-active"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-task-list-pane"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-empty") && element.text === "noMatchingTasks")).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-empty") && element.text === "noOpenTasks")).toBe(false);
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

  it("marks the task list pane for a lightweight transition when requested", () => {
    const container = new FakeElement();

    renderTasksView(
      container as unknown as HTMLElement,
      [baseTask],
      [baseTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true, animateTaskListTransition: true }
    );

    const list = collect(container).find((element) => element.classes.has("task-hub-task-list-pane"));

    expect(list?.classes.has("task-hub-task-list-pane-transition")).toBe(true);
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

  it("reschedules a dragged task to today without changing its existing time", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const overdueTask: TaskItem = {
      ...baseTask,
      id: "overdue",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Overdue 📅 2026-05-07 ⏰ 08:15",
      text: "Overdue",
      dueDate: "2026-05-07",
      scheduledDate: "2026-05-07T08:15"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [overdueTask],
      [overdueTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const dragRow = taskRowByTitle(container, "Overdue");
    const todaySection = collect(container).find((element) => element.classes.has("task-hub-task-section") && collect(element).some((child) => child.text === "today (0)"));
    const dataTransfer = fakeDataTransfer();

    expect(dragRow?.draggable).toBe(true);
    dragRow?.dispatch("dragstart", { dataTransfer });
    todaySection?.dispatch("drop", { dataTransfer });

    expect(viewHandlers.onTaskReschedule).toHaveBeenCalledWith(overdueTask, {
      dateKey: "2026-05-08",
      startMinutes: 495
    });
  });

  it("hides the overdue section when it has no tasks so today is first", () => {
    const container = new FakeElement();
    const todayTask: TaskItem = {
      ...baseTask,
      id: "today-only",
      text: "Today only",
      dueDate: "2026-05-08"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [todayTask],
      [todayTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const sections = collect(container).filter((element) => element.classes.has("task-hub-task-section"));
    const sectionTitles = sections
      .map((section) => collect(section).find((child) => child.type === "h3")?.text)
      .filter((title): title is string => Boolean(title));

    expect(sectionTitles[0]).toBe("today (1)");
    expect(sectionTitles).not.toContain("overdue (0)");
  });

  it("drops a task onto this week by moving it to the day after tomorrow", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const todayTask: TaskItem = {
      ...baseTask,
      id: "today",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Today 📅 2026-05-08",
      text: "Today",
      dueDate: "2026-05-08",
      scheduledDate: undefined
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [todayTask],
      [todayTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const dragRow = taskRowByTitle(container, "Today");
    const thisWeekSection = collect(container).find((element) => element.classes.has("task-hub-task-section") && collect(element).some((child) => child.text === "thisWeek (0)"));
    const dataTransfer = fakeDataTransfer();

    dragRow?.dispatch("dragstart", { dataTransfer });
    thisWeekSection?.dispatch("drop", { dataTransfer });

    expect(viewHandlers.onTaskReschedule).toHaveBeenCalledWith(todayTask, "2026-05-10");
  });

  it("reschedules command-selected tasks together when dropped onto a date bucket", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const overdueTask: TaskItem = {
      ...baseTask,
      id: "overdue",
      stableId: "vault:th_overdue",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Overdue 📅 2026-05-07",
      text: "Overdue",
      dueDate: "2026-05-07"
    };
    const todayTask: TaskItem = {
      ...baseTask,
      id: "today",
      stableId: "vault:th_today",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Today 📅 2026-05-08",
      text: "Today",
      dueDate: "2026-05-08"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [overdueTask, todayTask],
      [overdueTask, todayTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        selectedTaskIds: new Set(["overdue", "today"])
      }
    );

    const dragRow = taskRowByTitle(container, "Overdue");
    const tomorrowSection = collect(container).find((element) => element.classes.has("task-hub-task-section") && collect(element).some((child) => child.text === "tomorrow (0)"));
    const dataTransfer = fakeDataTransfer();

    dragRow?.dispatch("dragstart", { dataTransfer });
    tomorrowSection?.dispatch("drop", { dataTransfer });

    expect(viewHandlers.onTaskReschedule).toHaveBeenCalledTimes(2);
    expect(viewHandlers.onTaskReschedule).toHaveBeenNthCalledWith(1, overdueTask, "2026-05-09");
    expect(viewHandlers.onTaskReschedule).toHaveBeenNthCalledWith(2, todayTask, "2026-05-09");
  });

  it("does not reschedule when a task is dropped back into its current bucket", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const todayTask: TaskItem = {
      ...baseTask,
      id: "today",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Today 📅 2026-05-08",
      text: "Today",
      dueDate: "2026-05-08"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [todayTask],
      [todayTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const dragRow = taskRowByTitle(container, "Today");
    const todaySection = collect(container).find((element) => element.classes.has("task-hub-task-section") && collect(element).some((child) => child.text === "today (1)"));
    const dataTransfer = fakeDataTransfer();

    dragRow?.dispatch("dragstart", { dataTransfer });
    const dragover = todaySection?.dispatch("dragover", { dataTransfer });
    todaySection?.dispatch("drop", { dataTransfer });

    expect(dragover?.preventDefault).not.toHaveBeenCalled();
    expect(viewHandlers.onTaskReschedule).not.toHaveBeenCalled();
  });

  it("reorders tasks within the same date when dropped onto another row", () => {
    const container = new FakeElement();
    const viewHandlers = handlers();
    const firstTask: TaskItem = {
      ...baseTask,
      id: "vault:1",
      stableId: "vault:th_first",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] First 📅 2026-05-08",
      text: "First",
      dueDate: "2026-05-08"
    };
    const secondTask: TaskItem = {
      ...baseTask,
      id: "vault:2",
      stableId: "vault:th_second",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Second 📅 2026-05-08",
      text: "Second",
      dueDate: "2026-05-08"
    };
    const thirdTask: TaskItem = {
      ...baseTask,
      id: "vault:3",
      stableId: "vault:th_third",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Third 📅 2026-05-08",
      text: "Third",
      dueDate: "2026-05-08"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask, thirdTask],
      [firstTask, secondTask, thirdTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      viewHandlers,
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    const dragRow = taskRowByTitle(container, "First");
    const dropRow = taskRowByTitle(container, "Third");
    const dataTransfer = fakeDataTransfer();

    dragRow!.clientY = 0;
    dropRow!.clientY = 0;
    dragRow?.dispatch("dragstart", { dataTransfer });
    dropRow?.dispatch("drop", { dataTransfer, clientY: 30 });

    expect(viewHandlers.onTaskReorder).toHaveBeenCalledWith(firstTask, thirdTask, "after");
    expect(viewHandlers.onTaskReschedule).not.toHaveBeenCalled();
  });

  it("renders same-date tasks using the saved manual order before default order", () => {
    const container = new FakeElement();
    const firstTask: TaskItem = {
      ...baseTask,
      id: "vault:1",
      stableId: "vault:th_first",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] First 📅 2026-05-08",
      text: "First",
      dueDate: "2026-05-08"
    };
    const secondTask: TaskItem = {
      ...baseTask,
      id: "vault:2",
      stableId: "vault:th_second",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Second 📅 2026-05-08",
      text: "Second",
      dueDate: "2026-05-08"
    };
    const thirdTask: TaskItem = {
      ...baseTask,
      id: "vault:3",
      stableId: "vault:th_third",
      source: "vault",
      externalId: undefined,
      externalSourceName: undefined,
      filePath: "Project.md",
      rawLine: "- [ ] Third 📅 2026-05-08",
      text: "Third",
      dueDate: "2026-05-08"
    };

    renderTasksView(
      container as unknown as HTMLElement,
      [firstTask, secondTask, thirdTask],
      [firstTask, secondTask, thirdTask],
      { status: "open", tags: [], sourceQuery: "", textQuery: "" },
      handlers(),
      new Date("2026-05-08T12:00:00Z"),
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        taskListManualOrder: {
          "2026-05-08": ["vault:th_third", "vault:th_first"]
        }
      }
    );

    const titles = collect(container)
      .filter((element) => element.classes.has("task-hub-task-row"))
      .map((row) => taskRowTitle(row))
      .filter(Boolean);

    expect(titles.slice(0, 3)).toEqual(["Third", "First", "Second"]);
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
    const sendPicker = collect(container).find((element) => element.classes.has("task-hub-send-target-select"));
    expect(testHandlers.onSendToTarget).toHaveBeenCalledWith(task, { type: "dida", projectId: "dida-project" });
    expect(actions?.classes.has("has-send-action")).toBe(true);
    expect(actions?.classes.has("is-long-language")).toBe(true);
    expect(sendButton?.classes.has("mod-cta")).toBe(true);
    expect(sendButton?.parent?.classes.has("task-hub-send-label-cell")).toBe(true);
    expect(sendPicker).toBeDefined();
    expect(sendPicker?.parent?.classes.has("task-hub-send-picker-cell")).toBe(true);
    expect(sendPicker?.value).toBe("dida:dida-project");
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

    const picker = collect(container).find((element) => element.classes.has("task-hub-send-target-select"));
    picker!.value = "dida:dida-project";
    picker?.change();
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
