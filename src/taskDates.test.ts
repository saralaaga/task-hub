import { isDateKeyWithinWindow, taskPlannedDateKey, taskWindowDateKey } from "./taskDates";
import type { TaskItem } from "./types";

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task-1",
    filePath: overrides.filePath ?? "Tasks.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    source: overrides.source ?? "vault",
    ...overrides
  };
}

describe("taskDates external windows", () => {
  it("prefers scheduled date over start date for planned date keys", () => {
    expect(
      taskPlannedDateKey(
        task({
          startDate: "2026-06-01",
          scheduledDate: "2026-06-08"
        })
      )
    ).toBe("2026-06-08");
  });

  it("uses completedDate as the window anchor for completed tasks", () => {
    expect(
      taskWindowDateKey(
        task({
          completed: true,
          completedDate: "2026-06-20",
          scheduledDate: "2026-06-08"
        })
      )
    ).toBe("2026-06-20");
  });

  it("checks whether a date key falls inside the configured window", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(isDateKeyWithinWindow("2026-06-01", now, 30, 30)).toBe(true);
    expect(isDateKeyWithinWindow("2026-08-05", now, 30, 30)).toBe(false);
  });
});
