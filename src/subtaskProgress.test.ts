import { buildSubtaskProgressIndex } from "./subtaskProgress";
import type { TaskItem } from "./types";

function task(overrides: Partial<TaskItem> & Pick<TaskItem, "id" | "text">): TaskItem {
  const { id, text, ...rest } = overrides;
  return {
    id,
    filePath: rest.filePath ?? "Project.md",
    line: rest.line ?? 0,
    rawLine: rest.rawLine ?? `- [ ] ${text}`,
    text,
    completed: rest.completed ?? false,
    tags: rest.tags ?? [],
    source: rest.source ?? "vault",
    ...rest
  };
}

describe("buildSubtaskProgressIndex", () => {
  it("averages direct leaf child completion into the parent percentage", () => {
    const progress = buildSubtaskProgressIndex([
      task({ id: "parent", text: "Parent" }),
      task({ id: "child-1", text: "Done", parentId: "parent", indent: 1, completed: true }),
      task({ id: "child-2", text: "Open", parentId: "parent", indent: 1, completed: false })
    ]);

    expect(progress.get("parent")).toEqual({
      percent: 50,
      roundedPercent: 50,
      directChildCount: 2,
      completeChildrenCount: 1,
      partialChildrenCount: 0,
      notStartedChildrenCount: 1
    });
  });

  it("recursively folds nested child progress into the parent", () => {
    const progress = buildSubtaskProgressIndex([
      task({ id: "parent", text: "Parent" }),
      task({ id: "nested-parent", text: "Nested", parentId: "parent", indent: 1 }),
      task({ id: "nested-done", text: "Nested done", parentId: "nested-parent", indent: 2, completed: true }),
      task({ id: "nested-open", text: "Nested open", parentId: "nested-parent", indent: 2, completed: false }),
      task({ id: "leaf-open", text: "Leaf open", parentId: "parent", indent: 1, completed: false })
    ]);

    expect(progress.get("nested-parent")).toEqual({
      percent: 50,
      roundedPercent: 50,
      directChildCount: 2,
      completeChildrenCount: 1,
      partialChildrenCount: 0,
      notStartedChildrenCount: 1
    });
    expect(progress.get("parent")).toEqual({
      percent: 25,
      roundedPercent: 25,
      directChildCount: 2,
      completeChildrenCount: 0,
      partialChildrenCount: 1,
      notStartedChildrenCount: 1
    });
  });

  it("ignores orphaned parent references that are not part of the indexed task tree", () => {
    const progress = buildSubtaskProgressIndex([
      task({ id: "orphan", text: "Orphan", parentId: "missing", indent: 1, completed: true })
    ]);

    expect(progress.size).toBe(0);
  });

  it("stores entries only for tasks that actually have children", () => {
    const progress = buildSubtaskProgressIndex([
      task({ id: "leaf", text: "Leaf", completed: true })
    ]);

    expect(progress.get("leaf")).toBeUndefined();
  });
});
