import {
  TaskNoteIndex,
  buildCalendarEventNoteKey,
  buildTaskNoteKey,
  createTaskNoteContent,
  parseTaskNoteFrontmatter,
  replaceTaskNoteBody,
  transferTaskNoteRelationship,
  updateTaskNoteFrontmatter
} from "./taskNotes";
import type { CalendarEvent, TaskItem } from "./types";

const vaultTask: TaskItem = {
  id: "vault:Inbox.md:0:abc",
  filePath: "Inbox.md",
  line: 0,
  rawLine: "- [ ] Pay invoice 📅 2026-05-20",
  text: "Pay invoice",
  completed: false,
  tags: ["#finance"],
  dueDate: "2026-05-20",
  source: "vault"
};

const appleTask: TaskItem = {
  ...vaultTask,
  id: "apple-reminders:reminder-1",
  filePath: "Apple Reminders/Inbox",
  rawLine: "",
  externalId: "reminder-1",
  source: "apple-reminders"
};

const didaTask: TaskItem = {
  ...vaultTask,
  id: "dida:task-1",
  filePath: "Dida/Inbox",
  rawLine: "",
  externalId: "task-1",
  source: "dida"
};

const event: CalendarEvent = {
  id: "event-1",
  sourceId: "apple-calendar",
  title: "Planning",
  start: "2026-05-20T10:00",
  end: "2026-05-20T11:00",
  allDay: false,
  calendarId: "work"
};

describe("task note relationships", () => {
  it("builds task note keys for vault and external tasks", () => {
    expect(buildTaskNoteKey(vaultTask)).toMatch(/^task:vault:Inbox\.md:0:[a-z0-9]+$/);
    expect(buildTaskNoteKey(appleTask)).toBe("task:apple-reminders:reminder-1");
    expect(buildTaskNoteKey(didaTask)).toBe("task:dida:task-1");
  });

  it("builds event note keys with source and start date", () => {
    expect(buildCalendarEventNoteKey(event)).toBe("event:apple-calendar:event-1:2026-05-20");
  });
});

describe("task note frontmatter", () => {
  it("creates a Task Hub note with frontmatter relationship metadata", () => {
    const content = createTaskNoteContent({
      noteId: "thn_1",
      relatedKey: buildTaskNoteKey(vaultTask),
      title: "Pay invoice",
      createdAt: "2026-05-29T10:30:12"
    });

    expect(content).toContain("taskhub-note: true");
    expect(content).toContain('taskhub-note-id: "thn_1"');
    expect(content).toContain("taskhub-related:");
    expect(parseTaskNoteFrontmatter(content)?.body).toBe("");
  });

  it("creates Thino multi-file metadata when requested", () => {
    const content = createTaskNoteContent({
      noteId: "thn_1",
      relatedKey: buildTaskNoteKey(vaultTask),
      title: "Pay invoice",
      createdAt: "2026-05-29T10:30:12.345Z",
      mode: "thino-multi-file"
    });

    expect(content).toContain('id: "20260529103012"');
    expect(content).toContain("createdAt: 2026-05-29T10:30:12.345Z");
    expect(content).toContain("updatedAt: 2026-05-29T10:30:12.345Z");
    expect(content).toContain('taskhub-note-id: "thn_1"');
  });

  it("updates existing frontmatter while preserving unrelated properties and body", () => {
    const content = [
      "---",
      "status: draft",
      "taskhub-related:",
      '  - "task:vault:Old.md:0:old"',
      "---",
      "Body"
    ].join("\n");

    const result = updateTaskNoteFrontmatter(content, {
      noteId: "thn_1",
      relatedKeys: ["task:vault:Inbox.md:0:new"],
      historyKeys: ["task:vault:Old.md:0:old"],
      updatedAt: "2026-05-29T11:00:00"
    });

    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("Expected update");
    expect(result.content).toContain("status: draft");
    expect(result.content).toContain('  - "task:vault:Inbox.md:0:new"');
    expect(result.content).toContain("taskhub-related-history:");
    expect(result.content).toContain("Body");
  });

  it("extracts editable note body without frontmatter", () => {
    const content = [
      "---",
      "taskhub-note: true",
      'taskhub-note-id: "thn_1"',
      "taskhub-related:",
      '  - "task:vault:Inbox.md:0:new"',
      "---",
      "",
      "First note line",
      "Second note line"
    ].join("\n");

    expect(parseTaskNoteFrontmatter(content)?.body).toBe("First note line\nSecond note line");
  });

  it("extracts tags from the note body", () => {
    const content = [
      "---",
      "taskhub-note: true",
      'taskhub-note-id: "thn_1"',
      "taskhub-related:",
      '  - "task:vault:Inbox.md:0:new"',
      "---",
      "",
      "现场记录 #比赛 #client/acme"
    ].join("\n");

    expect(parseTaskNoteFrontmatter(content)?.tags).toEqual(["#比赛", "#client/acme"]);
  });

  it("replaces only the note body while preserving frontmatter", () => {
    const content = createTaskNoteContent({
      noteId: "thn_1",
      relatedKey: "task:vault:Inbox.md:0:new",
      title: "Pay invoice",
      createdAt: "2026-05-29T10:30:12"
    });

    const result = replaceTaskNoteBody(content, "Updated body");

    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("Expected update");
    expect(result.content).toContain('taskhub-note-id: "thn_1"');
    expect(result.content).toContain("Updated body");
    expect(result.content).not.toContain("# Pay invoice");
  });

  it("rejects malformed frontmatter without rewriting content", () => {
    const result = updateTaskNoteFrontmatter("---\nstatus: draft\nBody", {
      relatedKeys: ["task:vault:Inbox.md:0:new"],
      updatedAt: "2026-05-29T11:00:00"
    });

    expect(result).toEqual({ status: "conflict", message: "Malformed YAML frontmatter." });
  });

  it("transfers a note relationship from a vault task to an Apple Reminder", () => {
    const content = createTaskNoteContent({
      noteId: "thn_1",
      relatedKey: "task:vault:Inbox.md:0:old",
      title: "Pay invoice",
      createdAt: "2026-05-29T10:30:12"
    });

    const result = transferTaskNoteRelationship(content, {
      fromKey: "task:vault:Inbox.md:0:old",
      toKey: "task:apple-reminders:reminder-created-1",
      updatedAt: "2026-05-29T11:00:00"
    });

    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("Expected update");
    const parsed = parseTaskNoteFrontmatter(result.content ?? "");
    expect(parsed?.related).toEqual(["task:apple-reminders:reminder-created-1"]);
    expect(parsed?.history).toContain("task:vault:Inbox.md:0:old");
  });
});

describe("TaskNoteIndex", () => {
  it("indexes note counts and body content by current relationship key", async () => {
    const index = new TaskNoteIndex({
      ignoredPaths: [],
      readFile: async () =>
        `${createTaskNoteContent({
          noteId: "thn_1",
          relatedKey: buildTaskNoteKey(vaultTask),
          title: "Pay invoice",
          createdAt: "2026-05-29T10:30:12"
        })}\nRemember to attach the receipt.`
    });

    await index.scanFiles([{ path: "Task Hub Notes/one.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } }]);

    expect(index.getNotesForKey(buildTaskNoteKey(vaultTask))).toEqual([
      expect.objectContaining({
        path: "Task Hub Notes/one.md",
        noteId: "thn_1",
        body: expect.stringContaining("Remember to attach")
      })
    ]);
    expect(index.getNoteCountForKey(buildTaskNoteKey(vaultTask))).toBe(1);
  });

  it("sorts notes by created time with newest first", async () => {
    const key = buildTaskNoteKey(vaultTask);
    const contents = new Map([
      [
        "Task Hub Notes/old.md",
        createTaskNoteContent({
          noteId: "old",
          relatedKey: key,
          title: "Old",
          createdAt: "2026-05-28T10:30:12"
        })
      ],
      [
        "Task Hub Notes/new.md",
        createTaskNoteContent({
          noteId: "new",
          relatedKey: key,
          title: "New",
          createdAt: "2026-05-29T10:30:12"
        })
      ]
    ]);
    const index = new TaskNoteIndex({
      ignoredPaths: [],
      readFile: async (file) => contents.get(file.path) ?? ""
    });

    await index.scanFiles([
      { path: "Task Hub Notes/old.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } },
      { path: "Task Hub Notes/new.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } }
    ]);

    expect(index.getNotesForKey(key).map((note) => note.noteId)).toEqual(["new", "old"]);
  });

  it("does not count history-only relationships as current notes", async () => {
    const update = updateTaskNoteFrontmatter("", {
      noteId: "thn_1",
      relatedKeys: ["task:apple-reminders:reminder-created-1"],
      historyKeys: [buildTaskNoteKey(vaultTask)],
      updatedAt: "2026-05-29T11:00:00"
    });
    if (update.status !== "updated") throw new Error("Expected update");
    const content = update.content;
    const index = new TaskNoteIndex({
      ignoredPaths: [],
      readFile: async () => content
    });

    await index.scanFiles([{ path: "Task Hub Notes/one.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } }]);

    expect(index.getNoteCountForKey(buildTaskNoteKey(vaultTask))).toBe(0);
    expect(index.getNoteCountForKey("task:apple-reminders:reminder-created-1")).toBe(1);
  });
});
