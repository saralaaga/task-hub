import {
  createTaskHubSessionSnapshot,
  collectCalendarUnscheduledTasks,
  collectUnscheduledTasks,
  restoreContentScrollAfterRender,
  restoreTaskHubSessionState,
  scrollExpandedTaskIntoView,
  shouldHandleTaskHubUndoShortcut
} from "./TaskHubView";
import type { TaskFilterState } from "../filtering/filters";
import type { TaskViewFilterSettings } from "../types";
import type { TaskItem } from "../types";

jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  ItemView: class {},
  MarkdownRenderer: { render: jest.fn() },
  Notice: class {},
  WorkspaceLeaf: class {}
}), { virtual: true });

const NOW = new Date("2026-06-04T12:00:00");

describe("collectUnscheduledTasks", () => {
  it("applies the existing task filters before listing unscheduled tasks", () => {
    const tasks = [
      task({ id: "match", text: "Write proposal", tags: ["#work"], source: "vault" }),
      task({ id: "wrong-text", text: "Buy milk", tags: ["#work"], source: "vault" }),
      task({ id: "wrong-tag", text: "Write notes", tags: ["#home"], source: "vault" }),
      task({ id: "scheduled", text: "Write scheduled", tags: ["#work"], source: "vault", dueDate: "2026-06-05" }),
      task({ id: "done", text: "Write done", tags: ["#work"], source: "vault", completed: true })
    ];

    const result = collectUnscheduledTasks(tasks, {
      ...baseFilters(),
      tags: ["#work"],
      textQuery: "write"
    }, NOW, () => true);

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  it("shows completed unscheduled tasks only when the status filter allows them", () => {
    const tasks = [
      task({ id: "open", completed: false }),
      task({ id: "done", completed: true })
    ];

    expect(collectUnscheduledTasks(tasks, baseFilters(), NOW, () => true).map((item) => item.id)).toEqual(["open"]);
    expect(collectUnscheduledTasks(tasks, { ...baseFilters(), status: "all" }, NOW, () => true).map((item) => item.id)).toEqual(["open", "done"]);
  });
});

describe("collectCalendarUnscheduledTasks", () => {
  it("keeps a just-completed unscheduled task available for its row exit animation", () => {
    const tasks = [
      task({ id: "open", completed: false }),
      task({ id: "done", completed: true })
    ];

    const result = collectCalendarUnscheduledTasks(tasks, baseFilters(), NOW, () => true, new Set(["done"]));

    expect(result.map((item) => item.id)).toEqual(["open", "done"]);
  });
});

describe("restoreContentScrollAfterRender", () => {
  it("restores the saved content scroll position after calendar or tag rerenders", () => {
    const container = { scrollTop: 0 } as HTMLElement;

    restoreContentScrollAfterRender(container, { preserveScroll: true, scrollTop: 280 });

    expect(container.scrollTop).toBe(280);
  });

  it("leaves ordinary rerenders at their natural scroll position", () => {
    const container = { scrollTop: 12 } as HTMLElement;

    restoreContentScrollAfterRender(container, { scrollTop: 280 });

    expect(container.scrollTop).toBe(12);
  });
});

describe("Task Hub session state", () => {
  it("restores the last closed view state ahead of the default view", () => {
    const restored = restoreTaskHubSessionState(
      {
        defaultView: "tasks",
        taskViewFilters: fallbackFilters(),
        lastSessionState: {
          view: "calendar",
          taskViewFilters: {
            status: "all",
            tags: ["#work"],
            sourceQuery: "apple-reminders",
            textQuery: "invoice"
          },
          calendarMode: "week",
          calendarFocusDate: "2026-06-04T08:30:00.000Z",
          visibleSourceIds: ["vault", "apple-reminders"],
          unscheduledPanelOpen: true
        }
      },
      () => new Date("2026-06-01T00:00:00.000Z")
    );

    expect(restored.view).toBe("calendar");
    expect(restored.filters).toEqual({
      status: "all",
      tags: ["#work"],
      conditions: undefined,
      sourceQuery: "apple-reminders",
      textQuery: "invoice"
    });
    expect(restored.calendarMode).toBe("week");
    expect(restored.calendarFocusDate.toISOString()).toBe("2026-06-04T08:30:00.000Z");
    expect([...restored.visibleSourceIds]).toEqual(["vault", "apple-reminders"]);
    expect(restored.unscheduledPanelOpen).toBe(true);
  });

  it("falls back to the default open state when no last session is stored", () => {
    const restored = restoreTaskHubSessionState(
      {
        defaultView: "tags",
        taskViewFilters: fallbackFilters()
      },
      () => new Date("2026-06-01T00:00:00.000Z")
    );

    expect(restored.view).toBe("tags");
    expect(restored.filters).toEqual(fallbackFilters());
    expect(restored.calendarMode).toBe("month");
    expect(restored.calendarFocusDate.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect([...restored.visibleSourceIds]).toEqual(["vault"]);
    expect(restored.unscheduledPanelOpen).toBe(false);
  });

  it("serializes the current view state into persisted settings data", () => {
    const snapshot = createTaskHubSessionSnapshot({
      view: "calendar",
      filters: {
        status: "all",
        tags: ["#ops"],
        tagQuery: "#focus",
        sourceQuery: "dida",
        textQuery: "follow up",
        conditions: { operator: "or", tag: "#client", dateBucket: "today", text: "ping" }
      },
      calendarMode: "day",
      calendarFocusDate: new Date("2026-06-09T09:15:00.000Z"),
      visibleSourceIds: new Set(["vault", "dida"]),
      unscheduledPanelOpen: true
    });

    expect(snapshot).toEqual({
      view: "calendar",
      taskViewFilters: {
        status: "all",
        tags: ["#ops"],
        tagQuery: "#focus",
        sourceQuery: "dida",
        textQuery: "follow up",
        conditions: { operator: "or", tag: "#client", dateBucket: "today", text: "ping" }
      },
      calendarMode: "day",
      calendarFocusDate: "2026-06-09T09:15:00.000Z",
      visibleSourceIds: ["vault", "dida"],
      unscheduledPanelOpen: true
    });
  });
});

describe("scrollExpandedTaskIntoView", () => {
  it("smoothly scrolls the task list down when expanded subtasks would overflow below the viewport", () => {
    const row = elementRect({ top: 180, bottom: 228 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 232, bottom: 420 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 40, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 178, behavior: "smooth" });
  });

  it("scrolls upward when the expanded parent row sits above the visible area", () => {
    const row = elementRect({ top: 4, bottom: 52 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 56, bottom: 160 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 120, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 106, behavior: "smooth" });
  });

  it("does nothing when the expanded task and its subtasks are already fully visible", () => {
    const row = elementRect({ top: 80, bottom: 128 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 132, bottom: 220 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 64, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).not.toHaveBeenCalled();
    expect(list.scrollTop).toBe(64);
  });

  it("falls back to the outer scroll container when the row lives inside a non-scrolling list wrapper", () => {
    const row = elementRect({ top: 180, bottom: 228 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 232, bottom: 420 }, { "data-parent-task-id": "parent" });
    const list = wrapperElement([row, subtree]);
    const outer = listElement({ top: 0, bottom: 300 }, 40, [list]);

    scrollExpandedTaskIntoView(outer as unknown as HTMLElement, "parent");

    expect(outer.scrollTo).toHaveBeenCalledWith({ top: 178, behavior: "smooth" });
  });
});

describe("shouldHandleTaskHubUndoShortcut", () => {
  it("handles ctrl/cmd+z inside Task Hub when focus is not in an editable field", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, key: "z" }))).toBe(true);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ metaKey: true, key: "Z" }))).toBe(true);
  });

  it("ignores undo shortcuts while typing in editable controls", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      ctrlKey: true,
      key: "z",
      target: editableTarget("input")
    }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      metaKey: true,
      key: "z",
      target: editableTarget("textarea")
    }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      ctrlKey: true,
      key: "z",
      target: editableTarget("div", true)
    }))).toBe(false);
  });

  it("ignores other modifier combinations and keys", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true, key: "z" }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, altKey: true, key: "z" }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, key: "y" }))).toBe(false);
  });
});

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

function fallbackFilters(): TaskViewFilterSettings {
  return {
    status: "open",
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: ""
  };
}

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task",
    filePath: overrides.filePath ?? "Inbox.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate,
    source: overrides.source ?? "vault"
  };
}

function listElement(
  rect: { top: number; bottom: number },
  scrollTop: number,
  children: Array<ReturnType<typeof elementRect> | ReturnType<typeof wrapperElement>>
) {
  const list = {
    children,
    scrollTop,
    scrollTo: jest.fn(),
    scrollHeight: 800,
    clientHeight: rect.bottom - rect.top,
    getBoundingClientRect: () => ({ top: rect.top, bottom: rect.bottom })
  };
  for (const child of children) {
    child.parentElement = list;
  }
  return list;
}

function elementRect(
  rect: { top: number; bottom: number },
  attrs: Record<string, string>
) {
  return {
    attrs: new Map(Object.entries(attrs)),
    children: [] as unknown[],
    classes: new Set<string>(),
    parentElement: undefined as unknown,
    scrollIntoView: jest.fn(),
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    },
    getBoundingClientRect: () => ({ top: rect.top, bottom: rect.bottom })
  };
}

function wrapperElement(
  children: Array<ReturnType<typeof elementRect>>
) {
  const wrapper = {
    attrs: new Map<string, string>(),
    classes: new Set<string>(),
    children,
    parentElement: undefined as unknown,
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    },
    getBoundingClientRect: () => ({ top: 0, bottom: 0 })
  };
  for (const child of children) {
    child.parentElement = wrapper;
  }
  return wrapper;
}

function keyboardEvent(overrides: Partial<KeyboardEvent> & { target?: EventTarget | null }): KeyboardEvent {
  return {
    key: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...overrides
  } as KeyboardEvent;
}

function editableTarget(tagName: string, isContentEditable = false): EventTarget {
  return {
    tagName: tagName.toUpperCase(),
    isContentEditable
  } as unknown as EventTarget;
}
