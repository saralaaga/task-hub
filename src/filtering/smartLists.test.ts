import { applySmartListToTasks, materializeLegacySmartLists, smartListTaskReferences } from "./smartLists";
import type { TaskHubSmartList, TaskItem } from "../types";

const NOW = new Date("2026-06-30T09:00:00.000Z");

describe("applySmartListToTasks", () => {
  it("returns only tasks explicitly stored in the smart list", () => {
    const tasks = [
      task({ id: "dynamic", stableId: "vault:th_dynamic", text: "Write proposal", tags: ["#work"] }),
      task({ id: "manual", stableId: "vault:th_manual", text: "Buy milk", tags: ["#home"] }),
      task({ id: "runtime", text: "Runtime only", tags: ["#work"] })
    ];
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      taskStableIds: ["vault:th_manual"],
      taskIds: ["runtime"],
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z"
    };

    expect(applySmartListToTasks(tasks, smartList, NOW).map((item) => item.id)).toEqual(["manual", "runtime"]);
  });
});

describe("materializeLegacySmartLists", () => {
  it("converts legacy filter-based smart lists into fixed task references", () => {
    const tasks = [
      task({ id: "dynamic", stableId: "vault:th_dynamic", text: "Write proposal", tags: ["#work"] }),
      task({ id: "manual", stableId: "vault:th_manual", text: "Buy milk", tags: ["#home"] }),
      task({ id: "runtime", text: "Runtime only", tags: ["#work"] })
    ];
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      filters: {
        status: "open",
        tags: [],
        tagQuery: "#work",
        sourceQuery: "",
        textQuery: ""
      },
      taskStableIds: ["vault:th_manual"],
      taskIds: [],
      excludedTaskStableIds: ["vault:th_dynamic"],
      excludedTaskIds: ["runtime"],
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z"
    };

    expect(materializeLegacySmartLists(tasks, [smartList], NOW)).toEqual({
      changed: true,
      smartLists: [{
        id: "focus",
        name: "Focus",
        taskStableIds: ["vault:th_manual"],
        taskIds: [],
        createdAt: "2026-06-30T08:00:00.000Z",
        updatedAt: "2026-06-30T09:00:00.000Z"
      }]
    });
  });

  it("leaves already-materialized smart lists unchanged", () => {
    const smartList: TaskHubSmartList = {
      id: "focus",
      name: "Focus",
      taskStableIds: ["vault:th_manual"],
      taskIds: [],
      createdAt: "2026-06-30T08:00:00.000Z",
      updatedAt: "2026-06-30T08:00:00.000Z"
    };

    expect(materializeLegacySmartLists([task({ id: "manual", stableId: "vault:th_manual" })], [smartList], NOW)).toEqual({
      changed: false,
      smartLists: [smartList]
    });
  });
});

describe("smartListTaskReferences", () => {
  it("captures stable IDs and runtime IDs without duplicates", () => {
    const tasks = [
      task({ id: "task-a", stableId: "vault:th_a" }),
      task({ id: "task-b", stableId: "vault:th_a" }),
      task({ id: "task-a" })
    ];

    expect(smartListTaskReferences(tasks)).toEqual({
      taskStableIds: ["vault:th_a"],
      taskIds: ["task-a"]
    });
  });
});

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task",
    stableId: overrides.stableId,
    filePath: overrides.filePath ?? "Inbox.md",
    line: 0,
    rawLine: "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    source: overrides.source ?? "vault"
  };
}
