import {
  applyTaskListManualOrder,
  cleanupTaskListManualOrder,
  reorderTaskListDate
} from "./taskListOrdering";
import type { TaskItem } from "./types";

describe("taskListOrdering", () => {
  const task = (overrides: Partial<TaskItem>): TaskItem => ({
    id: "vault:1",
    stableId: "vault:th_1",
    filePath: "Project.md",
    line: 0,
    rawLine: "- [ ] Task",
    text: "Task",
    completed: false,
    tags: [],
    source: "vault",
    dueDate: "2026-05-08",
    scheduledDate: overrides.scheduledDate,
    startDate: overrides.startDate,
    ...overrides
  });

  it("applies manual ordering within the same date only", () => {
    const first = task({ id: "a", stableId: "vault:th_a", text: "First" });
    const second = task({ id: "b", stableId: "vault:th_b", text: "Second" });
    const third = task({ id: "c", stableId: "vault:th_c", text: "Third", dueDate: "2026-05-09" });

    expect(
      applyTaskListManualOrder([first, second, third], {
        "2026-05-08": ["vault:th_b", "vault:th_a"]
      }).map((item) => item.text)
    ).toEqual(["Second", "First", "Third"]);
  });

  it("groups by planned date before falling back to legacy due dates", () => {
    const first = task({ id: "a", stableId: "vault:th_a", startDate: "2026-05-08", dueDate: undefined });
    const second = task({ id: "b", stableId: "vault:th_b", scheduledDate: "2026-05-08", dueDate: undefined });
    const third = task({ id: "c", stableId: "vault:th_c", dueDate: "2026-05-09" });

    expect(applyTaskListManualOrder([first, second, third], {}).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("reorders a date group around the drop anchor", () => {
    const first = task({ id: "a", stableId: "vault:th_a", text: "First" });
    const second = task({ id: "b", stableId: "vault:th_b", text: "Second" });
    const third = task({ id: "c", stableId: "vault:th_c", text: "Third" });

    expect(
      reorderTaskListDate([first, second, third], {}, first, third, "after")
    ).toEqual(["vault:th_b", "vault:th_c", "vault:th_a"]);
  });

  it("cleans orphaned and default-equivalent ordering entries", () => {
    const first = task({ id: "a", stableId: "vault:th_a", text: "First" });
    const second = task({ id: "b", stableId: "vault:th_b", text: "Second" });

    expect(
      cleanupTaskListManualOrder(
        {
          "2026-05-08": ["vault:th_a", "missing"],
          "2026-05-09": ["vault:th_missing"]
        },
        [first, second]
      )
    ).toEqual({});

    expect(
      cleanupTaskListManualOrder(
        {
          "2026-05-08": ["vault:th_b", "vault:th_a"]
        },
        [first, second]
      )
    ).toEqual({
      "2026-05-08": ["vault:th_b", "vault:th_a"]
    });
  });
});
