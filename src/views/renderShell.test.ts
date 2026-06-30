import { renderShell, renderTaskFilterPanel, type DashboardView } from "./renderShell";
import type { TaskFilterState } from "../filtering/filters";

jest.mock("obsidian", () => ({
  setIcon: jest.fn()
}), { virtual: true });

class FakeElement {
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
  focused = false;
  open = false;
  ownerDocument: FakeDocument;
  parentElement: FakeElement | undefined;
  text = "";
  type = "";
  value = "";
  classes = new Set<string>();
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  constructor(ownerDocument = new FakeDocument()) {
    this.ownerDocument = ownerDocument;
  }

  empty(): void {
    this.children = [];
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

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children = this.children.filter((existing) => existing !== child);
    this.children.push(child);
    return child;
  }

  focus(): void {
    this.focused = true;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = undefined;
  }

  trigger(name: string, event: Partial<FakeEvent> = {}): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn(), ...event });
    }
  }

  contains(target: FakeElement): boolean {
    return this === target || this.children.some((child) => child.contains(target));
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement(this.ownerDocument);
    child.parentElement = this;
    child.text = options.text ?? "";
    for (const cls of (options.cls ?? "").split(" ").filter(Boolean)) {
      child.classes.add(cls);
    }
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();

  addEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  removeEventListener(name: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((candidate) => candidate !== listener));
  }

  trigger(name: string, event: Partial<FakeEvent> = {}): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener({ key: "", preventDefault: jest.fn(), stopPropagation: jest.fn(), ...event });
    }
  }
}

type FakeEvent = {
  key: string;
  target?: FakeElement;
  preventDefault(): void;
  stopPropagation(): void;
};

function collect(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collect)];
}

function baseFilters(): TaskFilterState {
  return {
    status: "open",
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: "",
    conditions: { operator: "and", tag: "", dateBucket: "", text: "" }
  };
}

function renderForTest(overrides: Partial<TaskFilterState> = {}) {
  const container = new FakeElement();
  const bindTagInputSuggest = jest.fn();
  const handlers = {
    onViewChange: jest.fn<void, [DashboardView]>(),
    onRescan: jest.fn(),
    onCreateTask: jest.fn(),
    onUnscheduledToggle: jest.fn(),
    onStatusChange: jest.fn(),
    onConditionChange: jest.fn(),
    onClearFilters: jest.fn(),
    onTagQueryChange: jest.fn(),
    onSourceFilterChange: jest.fn(),
    onTextQueryChange: jest.fn()
  };

  renderShell(
    container as unknown as HTMLElement,
    {
      view: "tasks",
      availableTags: [],
      sourceFilters: [
        { id: "all", label: "all", count: 37 },
        { id: "vault", label: "vaultTasks", count: 20 },
        { id: "apple-reminders", label: "Apple Reminders", count: 17 }
      ],
      filters: { ...baseFilters(), ...overrides },
      stats: { taskCount: 0, indexed: 0, skipped: 0, failed: 0 },
      t: (key) => key
    },
    handlers,
    { bindTagInputSuggest }
  );

  return { container, handlers, bindTagInputSuggest };
}

function renderTaskFilterPanelForTest(overrides: Partial<TaskFilterState> = {}) {
  const container = new FakeElement();
  const bindTagInputSuggest = jest.fn();
  const handlers = {
    onConditionChange: jest.fn(),
    onClearFilters: jest.fn(),
    onTagQueryChange: jest.fn(),
    onSourceFilterChange: jest.fn(),
    onTextQueryChange: jest.fn()
  };

  renderTaskFilterPanel(
    container as unknown as HTMLElement,
    {
      availableTags: ["#home", "#errand", "#later", "#work", "#测试"],
      sourceFilters: [
        { id: "all", label: "all", count: 37 },
        { id: "vault", label: "vaultTasks", count: 20 },
        { id: "apple-reminders", label: "Apple Reminders", count: 17 }
      ],
      filters: { ...baseFilters(), ...overrides },
      t: (key) => key
    },
    handlers,
    { bindTagInputSuggest }
  );

  return { container, handlers, bindTagInputSuggest };
}

function renderShellForState(stateOverrides: Partial<Parameters<typeof renderShell>[1]> = {}) {
  const container = new FakeElement();
  const bindTagInputSuggest = jest.fn();
  const handlers = {
    onViewChange: jest.fn<void, [DashboardView]>(),
    onRescan: jest.fn(),
    onCreateTask: jest.fn(),
    onUnscheduledToggle: jest.fn(),
    onStatusChange: jest.fn(),
    onConditionChange: jest.fn(),
    onClearFilters: jest.fn(),
    onTagQueryChange: jest.fn(),
    onSourceFilterChange: jest.fn(),
    onTextQueryChange: jest.fn()
  };

  renderShell(
    container as unknown as HTMLElement,
    {
      view: "tasks",
      availableTags: ["#home", "#errand", "#later", "#work", "#测试"],
      sourceFilters: [
        { id: "all", label: "all", count: 37 },
        { id: "vault", label: "vaultTasks", count: 20 },
        { id: "apple-reminders", label: "Apple Reminders", count: 17 }
      ],
      filters: baseFilters(),
      stats: { taskCount: 0, indexed: 0, skipped: 0, failed: 0 },
      t: (key) => key,
      ...stateOverrides
    },
    handlers,
    { bindTagInputSuggest }
  );

  return { container, handlers, bindTagInputSuggest };
}

describe("renderShell", () => {
  it("applies search only when Enter or the search button is used", () => {
    const { container, handlers } = renderTaskFilterPanelForTest();
    const searchInput = collect(container).find((element) => element.attrs.get("placeholder") === "searchTasks");
    expect(searchInput).toBeDefined();

    searchInput!.value = "invoice";
    searchInput!.trigger("input");
    expect(handlers.onTextQueryChange).not.toHaveBeenCalled();

    searchInput!.trigger("keydown", { key: "Enter" });
    expect(handlers.onTextQueryChange).toHaveBeenCalledWith("invoice");

    searchInput!.value = "review";
    const searchButton = collect(container).find((element) => element.attrs.get("aria-label") === "search");
    expect(searchButton).toBeDefined();
    searchButton!.trigger("click");
    expect(handlers.onTextQueryChange).toHaveBeenLastCalledWith("review");
  });

  it("applies condition filters only from the panel action", () => {
    const { container, handlers, bindTagInputSuggest } = renderTaskFilterPanelForTest();
    const tagEditor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const tagInput = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const textInput = collect(container).find((element) => element.attrs.get("placeholder") === "conditionText");
    const applyButton = collect(container).find((element) => element.text === "applyFilters");
    expect(tagEditor).toBeDefined();
    expect(tagEditor?.attrs.get("role")).toBe("textbox");
    expect(collect(tagEditor!).find((element) => element.classes.has("task-hub-tag-editor-placeholder"))?.text).toBe("#project");
    expect(tagInput).toBeDefined();
    expect(textInput).toBeDefined();
    expect(applyButton).toBeDefined();
    expect(bindTagInputSuggest).toHaveBeenCalledWith(tagInput);
    expect(bindTagInputSuggest).toHaveBeenCalledWith(textInput);

    tagInput!.value = "#work";
    tagInput!.trigger("input");
    expect(handlers.onConditionChange).not.toHaveBeenCalled();

    applyButton!.trigger("click");
    expect(handlers.onConditionChange).toHaveBeenCalledWith({
      operator: "and",
      tag: "#work",
      dateBucket: "",
      text: ""
    });
  });

  it("renders condition tags as reusable chips and applies multiple tags", () => {
    const { container, handlers } = renderTaskFilterPanelForTest({
      conditions: { operator: "and", tag: "#home #errand", dateBucket: "", text: "" }
    });
    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const applyButton = collect(container).find((element) => element.text === "applyFilters");

    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#home", "#errand"]);
    expect(collect(editor!).every((element) => !element.classes.has("task-hub-tag-editor-chip") || element.classes.has("task-hub-task-tag"))).toBe(true);
    input!.value = "#later";
    input!.trigger("keydown", { key: " " });
    applyButton!.trigger("click");

    expect(handlers.onConditionChange).toHaveBeenCalledWith({
      operator: "and",
      tag: "#home #errand #later",
      dateBucket: "",
      text: ""
    });
  });

  it("does not add unavailable condition tags", () => {
    const { container, handlers } = renderTaskFilterPanelForTest();
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const applyButton = collect(container).find((element) => element.text === "applyFilters");

    input!.value = "#不存在";
    input!.trigger("keydown", { key: " " });
    applyButton!.trigger("click");

    expect(handlers.onConditionChange).toHaveBeenCalledWith({
      operator: "and",
      tag: "",
      dateBucket: "",
      text: ""
    });
  });

  it("keeps suggestion-selected condition tags from duplicating partial input", () => {
    const { container, handlers } = renderTaskFilterPanelForTest();
    const editor = collect(container).find((element) => element.classes.has("task-hub-tag-editor"));
    const input = collect(container).find((element) => element.classes.has("task-hub-tag-editor-input"));
    const applyButton = collect(container).find((element) => element.text === "applyFilters");

    input!.value = "#测";
    input!.trigger("keydown", { key: "Enter", target: input });
    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip"))).toHaveLength(0);

    input!.value = "#测试";
    input!.trigger("task-hub-tag-selected");
    applyButton!.trigger("click");

    expect(collect(editor!).filter((element) => element.classes.has("task-hub-tag-editor-chip")).map((chip) => chip.text)).toEqual(["#测试"]);
    expect(handlers.onConditionChange).toHaveBeenCalledWith({
      operator: "and",
      tag: "#测试",
      dateBucket: "",
      text: ""
    });
  });

  it("clears quick tag filters from the condition panel clear action", () => {
    const { container, handlers } = renderTaskFilterPanelForTest({ tagQuery: "#work" });
    const clearButton = collect(container).find((element) => element.text === "clearFilters");
    const activeCount = collect(container).find((element) => element.classes.has("task-hub-condition-count"));

    expect(activeCount?.text).toBe("1");
    clearButton?.trigger("click");
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("shows quick tag filters in the condition panel and lets them be cleared inline", () => {
    const { container, handlers } = renderTaskFilterPanelForTest({ tagQuery: "#work" });
    const label = collect(container).find((element) => element.text === "quickTagFilter");
    const chip = collect(container).find((element) => element.classes.has("task-hub-condition-quick-tag-chip"));
    const clearButton = collect(container).find((element) => element.classes.has("task-hub-condition-quick-tag-clear"));

    expect(label).toBeDefined();
    expect(chip?.text).toBe("#work");

    clearButton?.trigger("click");
    expect(handlers.onTagQueryChange).toHaveBeenCalledWith("");
  });

  it("places the condition operator with the date and text labels", () => {
    const { container } = renderTaskFilterPanelForTest();
    const header = collect(container).find((element) => element.classes.has("task-hub-condition-panel-header"));
    const dateRow = collect(container).find((element) => element.classes.has("task-hub-condition-row") && collect(element).some((child) => child.text === "conditionDate"));
    const textRow = collect(container).find((element) => element.classes.has("task-hub-condition-row") && collect(element).some((child) => child.text === "conditionText"));

    expect(header).toBeDefined();
    expect(collect(header!).some((element) => element.type === "select")).toBe(false);
    expect(dateRow).toBeDefined();
    expect(textRow).toBeDefined();
    expect(collect(dateRow!).some((element) => element.type === "select" && element.classes.has("task-hub-condition-operator"))).toBe(true);
    expect(collect(textRow!).some((element) => element.classes.has("task-hub-condition-operator-spacer"))).toBe(true);
  });

  it("renders source filters inside the condition panel", () => {
    const { container, handlers } = renderTaskFilterPanelForTest({ sourceQuery: "apple-reminders" });
    const panel = collect(container).find((element) => element.classes.has("task-hub-condition-panel"));
    const sourceRow = collect(container).find((element) => element.classes.has("task-hub-condition-source-row"));
    const appleChip = collect(container).find((element) => element.classes.has("task-hub-source-filter-chip") && collect(element).some((child) => child.text === "Apple Reminders"));
    const count = appleChip ? collect(appleChip).find((element) => element.classes.has("task-hub-source-filter-count")) : undefined;

    expect(panel).toBeDefined();
    expect(sourceRow).toBeDefined();
    expect(appleChip).toBeDefined();
    expect(appleChip?.classes.has("is-active")).toBe(true);
    expect(count?.text).toBe("17");

    appleChip!.trigger("click");
    expect(handlers.onSourceFilterChange).toHaveBeenCalledWith("apple-reminders");
  });

  it("closes the condition panel when clicking outside it", () => {
    const { container } = renderTaskFilterPanelForTest();
    const menu = collect(container).find((element) => element.classes.has("task-hub-condition-menu"));
    const panel = collect(container).find((element) => element.classes.has("task-hub-condition-panel"));
    const outside = new FakeElement(container.ownerDocument);
    expect(menu).toBeDefined();
    expect(panel).toBeDefined();

    menu!.open = true;
    menu!.trigger("toggle");
    container.ownerDocument.trigger("pointerdown", { target: panel });
    expect(menu!.open).toBe(true);

    container.ownerDocument.trigger("pointerdown", { target: outside });
    expect(menu!.open).toBe(false);
  });

  it("shows disabled busy feedback while rescanning", () => {
    const { container } = renderShellForState({ isRefreshing: true });
    const rescanButton = collect(container).find((element) => element.attrs.get("aria-label") === "rescanning");

    expect(rescanButton).toBeDefined();
    expect(rescanButton!.disabled).toBe(true);
    expect(rescanButton!.attrs.get("aria-busy")).toBe("true");
    expect(rescanButton!.classes.has("is-refreshing")).toBe(true);
  });

  it("opens the create task flow from the toolbar", () => {
    const { container, handlers } = renderForTest();
    const createButton = collect(container).find((element) => element.attrs.get("aria-label") === "add");

    expect(createButton).toBeDefined();
    createButton!.trigger("click");
    expect(handlers.onCreateTask).toHaveBeenCalledTimes(1);
  });

  it("places the unscheduled button between add and rescan", () => {
    const { container, handlers } = renderShellForState({ unscheduledTaskCount: 3, unscheduledPanelOpen: true });
    const buttons = collect(container).filter((element) => element.type === "button");
    const addIndex = buttons.findIndex((element) => element.attrs.get("aria-label") === "add");
    const unscheduledIndex = buttons.findIndex((element) => element.attrs.get("aria-label") === "unscheduledTasks");
    const rescanIndex = buttons.findIndex((element) => element.attrs.get("aria-label") === "rescan");
    const unscheduled = buttons[unscheduledIndex];

    expect(addIndex).toBeGreaterThanOrEqual(0);
    expect(unscheduledIndex).toBe(addIndex + 1);
    expect(rescanIndex).toBe(unscheduledIndex + 1);
    expect(unscheduled.classes.has("is-active")).toBe(true);
    expect(collect(unscheduled).some((element) => element.text === "3")).toBe(true);

    unscheduled.trigger("click");
    expect(handlers.onUnscheduledToggle).toHaveBeenCalledTimes(1);
  });
});
