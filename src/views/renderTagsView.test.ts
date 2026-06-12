jest.mock("obsidian", () => ({
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

import { renderTagsView } from "./renderTagsView";
import type { TaskItem } from "../types";

const mockMenus: Array<{ items: Array<{ title: string; icon: string; disabled?: boolean; click?: () => void }>; shownAt: unknown }> = [];

class FakeElement {
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  checked = false;
  disabled = false;
  draggable = false;
  text = "";
  type = "";
  classes = new Set<string>();
  style = { setProperty: jest.fn() };
  listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  win = {
    requestAnimationFrame: undefined as ((callback: FrameRequestCallback) => number) | undefined,
    getComputedStyle: () => ({ lineHeight: "16px" })
  };

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

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  createEl(tag: string, options: { cls?: string; text?: string; type?: string } = {}): FakeElement {
    const child = this.append(options);
    child.type = options.type ?? tag;
    return child;
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  setAttr(name: string, value: string): void {
    this.attrs.set(name, value);
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
      listener({ stopPropagation: jest.fn(), preventDefault: jest.fn() });
    }
  }

  dispatch(name: string): FakeEvent {
    const event = { stopPropagation: jest.fn(), preventDefault: jest.fn() };
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
    return event;
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement();
    child.text = options.text ?? "";
    for (const cls of (options.cls ?? "").split(" ").filter(Boolean)) {
      child.classes.add(cls);
    }
    this.children.push(child);
    return child;
  }
}

type FakeEvent = {
  stopPropagation(): void;
  preventDefault(): void;
};

function collect(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collect)];
}

function findCheckbox(element: FakeElement): FakeElement | undefined {
  return collect(element).find((child) => child.type === "checkbox");
}

const task = (id: string, text: string, tags: string[], completed = false): TaskItem => ({
  id,
  filePath: "Project.md",
  line: 0,
  rawLine: completed ? `- [x] ${text}` : `- [ ] ${text}`,
  text,
  completed,
  tags,
  source: "vault"
});

const appleTask = (id: string, text: string, tags: string[], completed = false): TaskItem => ({
  ...task(id, text, tags, completed),
  source: "apple-reminders",
  externalId: id,
  externalSourceName: "Reminders",
  filePath: "Apple Reminders/Reminders"
});

describe("renderTagsView", () => {
  beforeEach(() => {
    mockMenus.length = 0;
  });

  it("renders tag cards with their tasks", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("a", "Open task", ["#work"]), task("b", "Done task", ["#work"], true), task("c", "Other task", ["#daily"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const elements = collect(container);
    expect(elements.some((element) => element.classes.has("task-hub-tag-card"))).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-tag-title") && element.text === "#work")).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-tag-task-title") && element.text === "Open task")).toBe(true);
    expect(elements.some((element) => element.classes.has("task-hub-tag-task-title") && element.text === "Done task")).toBe(true);
  });

  it("orders open tasks before completed tasks inside a tag card", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("done", "Done task", ["#work"], true), task("open", "Open task", ["#work"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const taskTitles = collect(container).filter((element) => element.classes.has("task-hub-tag-task-title")).map((element) => element.text);
    expect(taskTitles).toEqual(["Open task", "Done task"]);
  });

  it("applies source colors to Apple Reminders tag tasks", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [appleTask("apple", "Apple task", ["#work"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, sourceColors: { "apple-reminders": "#22c55e" } }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
  });

  it("uses Apple Reminder list colors for tag tasks", () => {
    const container = new FakeElement();
    const reminderTask = {
      ...appleTask("apple", "Apple task", ["#work"]),
      externalListId: "personal"
    };

    renderTagsView(
      container as unknown as HTMLElement,
      [reminderTask],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      {
        allowAppleReminderWriteback: true,
        sourceColors: { "apple-reminders": "#f59e0b" },
        taskColors: { personal: "#22c55e" }
      }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "#22c55e");
  });

  it("applies the Obsidian theme color to vault tag tasks", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("vault", "Vault task", ["#work"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, sourceColors: { vault: "var(--interactive-accent)" } }
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-source-color", "var(--interactive-accent)");
  });

  it("indents nested tasks inside tag cards", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [{ ...task("child", "Child task", ["#work"]), indent: 2 }],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const row = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    expect(row?.style.setProperty).toHaveBeenCalledWith("--task-hub-task-indent", "2");
  });

  it("renders other task-line tags as chips without repeating the card tag", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("multi", "Tagged task", ["#work", "#next", "#project/acme"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, orderedTags: ["#work"] }
    );

    const workTitle = collect(container).find((element) => element.classes.has("task-hub-tag-title") && element.text === "#work");
    const workCard = workTitle ? findAncestorWithClass(container, workTitle, "task-hub-tag-card") : undefined;
    const chips = workCard ? collect(workCard).filter((element) => element.classes.has("task-hub-task-tag")).map((element) => element.text) : [];
    expect(chips).toEqual(["#next", "#project/acme"]);
  });

  it("does not render child tags that belong to the current parent tag card as extra chips", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("parent", "Parent task", ["#project"]), task("nested", "Nested tag task", ["#project/acme", "#next"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, orderedTags: ["#project"] }
    );

    const projectTitle = collect(container).find((element) => element.classes.has("task-hub-tag-title") && element.text === "#project");
    const projectCard = projectTitle ? findAncestorWithClass(container, projectTitle, "task-hub-tag-card") : undefined;
    const chips = projectCard
      ? collect(projectCard).filter((element) => element.classes.has("task-hub-task-tag")).map((element) => element.text)
      : [];
    expect(chips).toEqual(["#next"]);
  });

  it("renders non-matching parent tasks as context rows for matching child tasks", () => {
    const container = new FakeElement();
    const parent = { ...task("parent", "Parent task", ["#project"]), indent: 0 };
    const child = { ...task("child", "Child task", ["#next"]), indent: 1, parentId: parent.id };

    renderTagsView(
      container as unknown as HTMLElement,
      [parent, child],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, orderedTags: ["#next"] }
    );

    const nextTitle = collect(container).find((element) => element.classes.has("task-hub-tag-title") && element.text === "#next");
    const nextCard = nextTitle ? findAncestorWithClass(container, nextTitle, "task-hub-tag-card") : undefined;
    const rows = nextCard ? collect(nextCard).filter((element) => element.classes.has("task-hub-tag-task")) : [];
    const titles = nextCard
      ? collect(nextCard).filter((element) => element.classes.has("task-hub-tag-task-title")).map((element) => element.text)
      : [];

    expect(titles).toEqual(["Parent task", "Child task"]);
    expect(rows[0]?.classes.has("is-context")).toBe(true);
    expect(rows[1]?.classes.has("is-context")).toBe(false);
  });

  it("renders tags from parent context rows", () => {
    const container = new FakeElement();
    const parent = { ...task("parent", "Parent task", ["#project", "#blocked"]), indent: 0 };
    const child = { ...task("child", "Child task", ["#next"]), indent: 1, parentId: parent.id };

    renderTagsView(
      container as unknown as HTMLElement,
      [parent, child],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, orderedTags: ["#next"] }
    );

    const nextTitle = collect(container).find((element) => element.classes.has("task-hub-tag-title") && element.text === "#next");
    const nextCard = nextTitle ? findAncestorWithClass(container, nextTitle, "task-hub-tag-card") : undefined;
    const contextRow = nextCard ? collect(nextCard).find((element) => element.classes.has("is-context")) : undefined;
    const chips = contextRow ? collect(contextRow).filter((element) => element.classes.has("task-hub-task-tag")).map((element) => element.text) : [];

    expect(chips).toEqual(["#project", "#blocked"]);
  });

  it("selects a task from a tag card", () => {
    const container = new FakeElement();
    const selectedTask = task("open", "Open task", ["#work"]);
    const onTaskSelect = jest.fn();

    renderTagsView(
      container as unknown as HTMLElement,
      [selectedTask],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect, onReorderTags: jest.fn() },
      (key) => key
    );

    const taskRow = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    taskRow?.click();
    expect(onTaskSelect).toHaveBeenCalledWith(selectedTask);
  });

  it("selects a tag from the tag card header", () => {
    const container = new FakeElement();
    const onTagSelect = jest.fn();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("open", "Open task", ["#work"])],
      { onTagSelect, onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const header = collect(container).find((element) => element.classes.has("task-hub-tag-header"));
    header?.click();

    expect(onTagSelect).toHaveBeenCalledWith("#work");
  });

  it("completes a task from a tag card checkbox", () => {
    const container = new FakeElement();
    const selectedTask = task("open", "Open task", ["#work"]);
    const onTaskComplete = jest.fn();

    renderTagsView(
      container as unknown as HTMLElement,
      [selectedTask],
      { onTagSelect: jest.fn(), onTaskComplete, onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true }
    );

    findCheckbox(container)?.click();

    expect(onTaskComplete).toHaveBeenCalledWith(selectedTask);
  });

  it("shows Dida task context actions from tag cards", () => {
    const container = new FakeElement();
    const didaTask = {
      ...task("dida-1", "Dida task", ["#work"]),
      source: "dida" as const,
      externalId: "dida-1",
      externalListId: "project-1",
      dueDate: "2026-06-05"
    };
    const onTaskJump = jest.fn();
    const onTaskDelete = jest.fn();

    renderTagsView(
      container as unknown as HTMLElement,
      [didaTask],
      {
        onTagSelect: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskSelect: jest.fn(),
        onTaskJump,
        onTaskDelete,
        onReorderTags: jest.fn()
      },
      (key) => key,
      { allowAppleReminderWriteback: false, allowDidaWriteback: true, allowDidaDelete: true }
    );

    const taskRow = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    const event = taskRow?.dispatch("contextmenu");

    expect(event?.preventDefault).toHaveBeenCalled();
    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["sourceDida", "markComplete", "openSource", "deleteFromDida"]);
    expect(mockMenus.at(-1)?.items[0].disabled).toBe(true);
    mockMenus.at(-1)?.items[2].click?.();
    mockMenus.at(-1)?.items[3].click?.();
    expect(onTaskJump).toHaveBeenCalledWith(didaTask);
    expect(onTaskDelete).toHaveBeenCalledWith(didaTask);
  });

  it("shows send to Dida for vault tasks from tag cards when enabled", () => {
    const container = new FakeElement();
    const vaultTask = task("vault-send", "Vault send", ["#work"]);
    const onSendToDida = jest.fn();

    renderTagsView(
      container as unknown as HTMLElement,
      [vaultTask],
      {
        onTagSelect: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskSelect: jest.fn(),
        onSendToDida,
        onReorderTags: jest.fn()
      },
      (key) => key,
      { allowAppleReminderWriteback: false, allowDidaCreate: true }
    );

    const taskRow = collect(container).find((element) => element.classes.has("task-hub-tag-task"));
    taskRow?.dispatch("contextmenu");

    expect(mockMenus.at(-1)?.items.map((item) => item.title)).toEqual(["sourceVaultTask", "markComplete", "openSource", "deleteCalendarItem", "sendToDida"]);
    expect(mockMenus.at(-1)?.items[0].disabled).toBe(true);
    mockMenus.at(-1)?.items[4].click?.();
    expect(onSendToDida).toHaveBeenCalledWith(vaultTask);
  });

  it("renders only the tasks provided by the caller", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [task("open", "Open task", ["#work"])],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const taskTitles = collect(container).filter((element) => element.classes.has("task-hub-tag-task-title")).map((element) => element.text);
    expect(taskTitles).toEqual(["Open task"]);
  });

  it("includes nested tag tasks in parent tag cards", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [
        task("parent", "Parent task", ["#project"]),
        task("child", "Child task", ["#project/acme"]),
        task("other", "Other task", ["#other"])
      ],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key
    );

    const parentTitle = collect(container).find((element) => element.classes.has("task-hub-tag-title") && element.text === "#project");
    const parentCard = parentTitle ? findAncestorWithClass(container, parentTitle, "task-hub-tag-card") : undefined;
    const parentTasks = parentCard
      ? collect(parentCard).filter((element) => element.classes.has("task-hub-tag-task-title")).map((element) => element.text)
      : [];

    expect(parentTasks).toEqual(["Parent task", "Child task"]);
  });

  it("renders tag cards in the provided order before fallback sorting", () => {
    const container = new FakeElement();

    renderTagsView(
      container as unknown as HTMLElement,
      [
        task("work", "Work task", ["#work"]),
        task("daily", "Daily task", ["#daily"]),
        task("project", "Project task", ["#project"])
      ],
      { onTagSelect: jest.fn(), onTaskComplete: jest.fn(), onTaskSelect: jest.fn(), onReorderTags: jest.fn() },
      (key) => key,
      { allowAppleReminderWriteback: true, orderedTags: ["#project", "#daily"] }
    );

    const titles = collect(container)
      .filter((element) => element.classes.has("task-hub-tag-title"))
      .map((element) => element.text);

    expect(titles).toEqual(["#project", "#daily", "#work"]);
  });
});

function findAncestorWithClass(root: FakeElement, target: FakeElement, className: string): FakeElement | undefined {
  return findAncestor(root, target, className);
}

function findAncestor(
  current: FakeElement,
  target: FakeElement,
  className: string,
  closest: FakeElement | undefined = undefined
): FakeElement | undefined {
  const nextClosest = current.classes.has(className) ? current : closest;
  if (current === target) return nextClosest;
  for (const child of current.children) {
    const found = findAncestor(child, target, className, nextClosest);
    if (found) return found;
  }
  return undefined;
}
