import {
  applyTaskNoteManualOrder,
  cleanupTaskNotePinnedEntry,
  cleanupTaskNoteManualOrderEntry,
  prioritizeTaskNoteInManualOrder,
  reorderTaskNotes,
  sortTaskNotes,
  taskNoteOrderItemKey,
  taskNoteOrderScopeKey,
  togglePinnedTaskNote
} from "./taskNoteOrdering";
import type { TaskItem } from "./types";
import type { TaskNote } from "./taskNotes";

describe("taskNoteOrdering", () => {
  const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "vault:1",
    stableId: "vault:th_1",
    filePath: "Project.md",
    line: 0,
    rawLine: "- [ ] Task",
    text: "Task",
    completed: false,
    tags: [],
    source: "vault",
    ...overrides
  });

  const note = (overrides: Partial<TaskNote>): TaskNote => ({
    path: "Task Hub Notes/one.md",
    noteId: "note-1",
    related: [],
    history: [],
    title: "One",
    body: "Body",
    bodyStartLine: 10,
    tags: [],
    createdAt: "2026-06-28T10:00:00.000Z",
    ...overrides
  });

  it("uses task stable ids as the note-order scope key", () => {
    expect(taskNoteOrderScopeKey(task())).toBe("task:vault:th_1");
    expect(taskNoteOrderScopeKey(task({ stableId: undefined, id: "volatile-id" }))).toBe("task:volatile-id");
  });

  it("applies manual note ordering and falls back to note path when noteId is missing", () => {
    const first = note({ noteId: "note-1", path: "Task Hub Notes/one.md" });
    const second = note({ noteId: undefined, path: "Task Hub Notes/two.md", title: "Two" });

    expect(taskNoteOrderItemKey(second)).toBe("Task Hub Notes/two.md");
    expect(
      applyTaskNoteManualOrder([first, second], ["Task Hub Notes/two.md", "note-1"]).map((item) => item.title)
    ).toEqual(["Two", "One"]);
  });

  it("reorders note keys around the drop anchor", () => {
    const first = note({ noteId: "note-1", title: "One" });
    const second = note({ noteId: "note-2", title: "Two", path: "Task Hub Notes/two.md" });
    const third = note({ noteId: "note-3", title: "Three", path: "Task Hub Notes/three.md" });

    expect(
      reorderTaskNotes([first, second, third], {}, task(), first, third, "after")
    ).toEqual(["note-2", "note-3", "note-1"]);
  });

  it("cleans orphaned and default-equivalent note ordering entries", () => {
    const first = note({ noteId: "note-1", title: "One" });
    const second = note({ noteId: "note-2", title: "Two", path: "Task Hub Notes/two.md" });

    expect(cleanupTaskNoteManualOrderEntry([first, second], ["note-1", "missing"])).toEqual([]);
    expect(cleanupTaskNoteManualOrderEntry([first, second], ["note-2", "note-1"])).toEqual(["note-2", "note-1"]);
  });

  it("shows pinned notes first while keeping manual ordering inside the pinned group", () => {
    const first = note({ noteId: "note-1", title: "One" });
    const second = note({ noteId: "note-2", title: "Two", path: "Task Hub Notes/two.md" });
    const third = note({ noteId: "note-3", title: "Three", path: "Task Hub Notes/three.md" });

    expect(
      sortTaskNotes([first, second, third], ["note-3", "note-1", "note-2"], ["note-1", "note-3"]).map((item) => item.title)
    ).toEqual(["Three", "One", "Two"]);
  });

  it("pins a note by prepending it and unpins by removing it", () => {
    const first = note({ noteId: "note-1", title: "One" });
    const second = note({ noteId: "note-2", title: "Two", path: "Task Hub Notes/two.md" });

    expect(togglePinnedTaskNote({}, task(), first)).toEqual(["note-1"]);
    expect(togglePinnedTaskNote({ "task:vault:th_1": ["note-1", "note-2"] }, task(), first)).toEqual(["note-2"]);
    expect(prioritizeTaskNoteInManualOrder([first, second], { "task:vault:th_1": ["note-2", "note-1"] }, task(), first)).toEqual([
      "note-1",
      "note-2"
    ]);
  });

  it("cleans pinned keys that no longer exist", () => {
    const first = note({ noteId: "note-1", title: "One" });
    const second = note({ noteId: "note-2", title: "Two", path: "Task Hub Notes/two.md" });

    expect(cleanupTaskNotePinnedEntry([first, second], ["note-2", "missing", "note-2"])).toEqual(["note-2"]);
  });
});
