import { collectCalendarUnscheduledTasks, collectUnscheduledTasks, restoreContentScrollAfterRender } from "./TaskHubView";
import type { TaskFilterState } from "../filtering/filters";
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

function baseFilters(): TaskFilterState {
  return {
    status: "open",
    tags: [],
    sourceQuery: "",
    textQuery: "",
    conditions: { operator: "and", tag: "", dateBucket: "", text: "" }
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
