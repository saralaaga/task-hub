import {
  HUB_NOTE_ID_PATTERN,
  HUB_NOTE_UNDATED_DATE,
  HubNoteIndex,
  createHubNoteId,
  createHubNoteContent,
  parseHubNoteFrontmatter,
  replaceHubNoteBody,
  timelineDateForHubNote,
  toggleHubNoteTaskCheckbox,
  toTimelineHubNote
} from "./hubNotes";

describe("parseHubNoteFrontmatter", () => {
  it("parses legacy task notes into the unified note model", () => {
    const parsed = parseHubNoteFrontmatter(
      `---
taskhub-note: true
taskhub-note-id: "note_task"
taskhub-related:
  - "task:vault:Daily.md:4:hash"
taskhub-related-history:
  - "task:apple-reminders:abc"
taskhub-created: 2026-07-10T09:30:00.000Z
taskhub-updated: 2026-07-10T10:30:00.000Z
---

Task note body #work
`,
      "Notes/task.md"
    );

    expect(parsed).toMatchObject({
      noteId: "note_task",
      kind: "task-related",
      related: ["task:vault:Daily.md:4:hash"],
      history: ["task:apple-reminders:abc"],
      date: undefined,
      sourceKind: "task-note",
      title: "Task note body #work",
      tags: ["#work"]
    });
  });

  it("parses legacy dated notes into the unified note model", () => {
    const parsed = parseHubNoteFrontmatter(
      `---
taskhub-type: note
taskhub-note-id: "note_dated"
taskhub-date: 2026-07-11
title: "Morning note"
taskhub-created: 2026-07-11T08:15:00.000Z
taskhub-updated: 2026-07-11T08:20:00.000Z
tags:
  - daily
---

Body preview
`,
      "Notes/dated.md"
    );

    expect(parsed).toMatchObject({
      noteId: "note_dated",
      kind: "manual",
      date: "2026-07-11",
      sourceKind: "dated-note",
      title: "Morning note",
      tags: ["#daily"],
      related: [],
      history: []
    });
  });

  it("parses hybrid notes with both date and related task metadata", () => {
    const parsed = parseHubNoteFrontmatter(
      `---
taskhub-note: true
taskhub-note-id: "note_hybrid"
taskhub-kind: "transcript"
taskhub-date: 2026-07-12
taskhub-related:
  - "task:vault:Inbox.md:2:hash"
taskhub-created: 2026-07-12T07:00:00.000Z
taskhub-updated: 2026-07-12T08:00:00.000Z
---

Hybrid body
`,
      "Notes/hybrid.md"
    );

    expect(parsed).toMatchObject({
      noteId: "note_hybrid",
      kind: "transcript",
      date: "2026-07-12",
      related: ["task:vault:Inbox.md:2:hash"],
      sourceKind: "hybrid"
    });
  });

  it("treats unified date-only notes as dated notes instead of hybrid notes", () => {
    const parsed = parseHubNoteFrontmatter(
      `---
taskhub-note: true
taskhub-note-id: "note_timeline"
taskhub-type: note
taskhub-date: 2026-07-13
title: "Timeline note"
taskhub-created: 2026-07-13T07:00:00.000Z
taskhub-updated: 2026-07-13T08:00:00.000Z
---

Timeline body
`,
      "Notes/timeline.md"
    );

    expect(parsed).toMatchObject({
      kind: "manual",
      date: "2026-07-13",
      related: [],
      sourceKind: "dated-note"
    });
  });
});

describe("content helpers", () => {
  it("creates unified hub note content that can be read by both note models", () => {
    const content = createHubNoteContent({
      noteId: "note_20260711_abcd",
      kind: "imported",
      title: "Launch plan",
      createdAt: "2026-07-11T10:30:12.000Z",
      date: "2026-07-11",
      relatedKeys: ["task:vault:Projects/Launch.md:42:hash"],
      body: "Ship notes"
    });

    expect(content).toContain("taskhub-note: true");
    expect(content).toContain('taskhub-kind: "imported"');
    expect(content).toContain("taskhub-type: note");
    expect(content).toContain("taskhub-date: 2026-07-11");
    expect(content).toContain("taskhub-related:");
    expect(content).toContain('title: "Launch plan"');
  });

  it("writes Thino metadata using Thino-compatible timestamps", () => {
    const content = createHubNoteContent({
      noteId: "note_20260711_thino",
      title: "Launch plan",
      createdAt: "2026-07-11T10:30:12.000Z",
      addThinoIdToTaskHubNotes: true
    });

    expect(content).toContain('id: "20260711103012"');
    expect(content).toMatch(/createdAt: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/u);
    expect(content).toMatch(/updatedAt: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/u);
    expect(content).not.toContain("createdAt: 2026-07-11T10:30:12.000Z");
  });

  it("updates body text while preserving unified metadata", () => {
    const original = createHubNoteContent({
      noteId: "note_20260711_abcd",
      kind: "imported",
      title: "Launch plan",
      createdAt: "2026-07-11T10:30:12.000Z",
      date: "2026-07-11",
      relatedKeys: ["task:vault:Projects/Launch.md:42:hash"],
      body: "Ship notes",
      addThinoIdToTaskHubNotes: true
    });

    const result = replaceHubNoteBody(original, "Updated launch notes", "2026-07-11T11:45:00.000Z");

    expect(result.status).toBe("updated");
    if (result.status !== "updated") return;
    expect(result.content).toContain('taskhub-note-id: "note_20260711_abcd"');
    expect(result.content).toContain('taskhub-kind: "imported"');
    expect(result.content).toContain("taskhub-date: 2026-07-11");
    expect(result.content).toContain("taskhub-related:");
    expect(result.content).toContain("taskhub-updated: 2026-07-11T11:45:00.000Z");
    expect(result.content).toMatch(/updatedAt: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/u);
    expect(result.content).not.toContain("updatedAt: 2026-07-11T11:45:00.000Z");
    expect(result.content).toContain('title: "Updated launch notes"');
    expect(result.content).toContain("Updated launch notes");
  });

  it("repairs legacy ISO Thino timestamps when an existing note is updated", () => {
    const original = `---
id: "20260711103012"
createdAt: 2026-07-11T10:30:12.000Z
updatedAt: 2026-07-11T10:30:12.000Z
taskhub-note: true
taskhub-note-id: "note_legacy"
title: "Legacy note"
taskhub-created: 2026-07-11T10:30:12.000Z
taskhub-updated: 2026-07-11T10:30:12.000Z
tags:
  - task-hub-note
---
Legacy body
`;

    const result = replaceHubNoteBody(original, "Updated legacy body", "2026-07-11T11:45:00.000Z");

    expect(result.status).toBe("updated");
    if (result.status !== "updated") return;
    expect(result.content).toMatch(/createdAt: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/u);
    expect(result.content).toMatch(/updatedAt: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/u);
    expect(result.content).not.toContain("createdAt: 2026-07-11T10:30:12.000Z");
    expect(result.content).not.toContain("updatedAt: 2026-07-11T11:45:00.000Z");
  });

  it("updates a checkbox line while preserving unified metadata", () => {
    const original = createHubNoteContent({
      noteId: "note_20260712_daily",
      title: "Daily note",
      createdAt: "2026-07-12T08:00:00.000Z",
      date: "2026-07-12",
      body: "- [ ] First task\n  - [ ] Child task"
    });
    const parsed = parseHubNoteFrontmatter(original);
    if (!parsed) throw new Error("Expected note frontmatter");

    const result = toggleHubNoteTaskCheckbox(original, {
      sourceLine: parsed.bodyStartLine + 1,
      rawLine: "  - [ ] Child task",
      checked: true,
      updatedAt: "2026-07-12T09:00:00.000Z"
    });

    expect(result.status).toBe("updated");
    if (result.status !== "updated") return;
    expect(result.content).toContain("- [ ] First task\n  - [x] Child task\n");
    expect(result.content).toContain("taskhub-updated: 2026-07-12T09:00:00.000Z");
  });

  it("refuses to update a checkbox line when the source line changed", () => {
    const original = createHubNoteContent({
      noteId: "note_20260712_daily",
      title: "Daily note",
      createdAt: "2026-07-12T08:00:00.000Z",
      date: "2026-07-12",
      body: "- [ ] Different task"
    });
    const parsed = parseHubNoteFrontmatter(original);
    if (!parsed) throw new Error("Expected note frontmatter");

    const result = toggleHubNoteTaskCheckbox(original, {
      sourceLine: parsed.bodyStartLine,
      rawLine: "- [ ] Original task",
      checked: true,
      updatedAt: "2026-07-12T09:00:00.000Z"
    });

    expect(result).toMatchObject({
      status: "conflict",
      message: "Task checkbox line no longer matches the note."
    });
  });
});

describe("timeline helpers", () => {
  it("creates canonical hub note IDs from the shared generator", () => {
    const noteId = createHubNoteId(new Date("2026-07-11T10:30:12.999Z"), "Ab-cd");
    expect(noteId).toBe("thn_20260711103012_abcd");
    expect(noteId).toMatch(HUB_NOTE_ID_PATTERN);
  });

  it("derives a timeline date from createdAt when no explicit note date exists", () => {
    const note = {
      path: "Notes/task.md",
      noteId: "task",
      kind: "task-related",
      title: "Task note",
      body: "Body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T21:00:00.000Z",
      updatedAt: "2026-07-09T21:05:00.000Z",
      related: ["task:vault:Daily.md:4:hash"],
      history: [],
      sourceKind: "task-note" as const
    };

    expect(timelineDateForHubNote(note)).toBe("2026-07-09");
    expect(toTimelineHubNote(note)).toMatchObject({
      date: "2026-07-09",
      dateDerived: true
    });
  });

  it("falls back to the undated sentinel when no date-like metadata exists", () => {
    const note = {
      path: "Notes/task.md",
      kind: "manual",
      title: "Task note",
      body: "Body",
      bodyStartLine: 7,
      tags: [],
      related: ["task:vault:Daily.md:4:hash"],
      history: [],
      sourceKind: "task-note" as const
    };

    expect(toTimelineHubNote(note)).toMatchObject({
      date: HUB_NOTE_UNDATED_DATE,
      dateDerived: true
    });
  });
});

describe("HubNoteIndex", () => {
  it("indexes notes for both timeline and relation lookups", async () => {
    const files = [
      {
        path: "Notes/task.md",
        extension: "md",
        stat: { ctime: 1, mtime: 1, size: 10 }
      },
      {
        path: "Notes/dated.md",
        extension: "md",
        stat: { ctime: 2, mtime: 2, size: 10 }
      },
      {
        path: "Notes/undated.md",
        extension: "md",
        stat: { ctime: 3, mtime: 3, size: 10 }
      }
    ];
    const contentByPath = {
      "Notes/task.md": `---
taskhub-note: true
taskhub-related:
  - "task:vault:Daily.md:4:hash"
taskhub-created: 2026-07-10T09:30:00.000Z
---

Task body
`,
      "Notes/dated.md": `---
taskhub-type: note
taskhub-date: 2026-07-11
taskhub-created: 2026-07-11T08:15:00.000Z
---

Dated body
`,
      "Notes/undated.md": `---
taskhub-note: true
taskhub-related:
  - "task:vault:Daily.md:4:hash"
---

Undated body
`
    } as const;

    const index = new HubNoteIndex({
      ignoredPaths: [],
      readFile: async (file) => contentByPath[file.path as keyof typeof contentByPath]
    });

    await index.scanFiles(files);

    expect(index.getNotesForKey("task:vault:Daily.md:4:hash").map((note) => note.path)).toEqual([
      "Notes/task.md",
      "Notes/undated.md"
    ]);
    expect(index.getTimelineNotes().map((note) => note.path)).toEqual([
      "Notes/dated.md",
      "Notes/task.md",
      "Notes/undated.md"
    ]);
    expect(index.getNotesForDate("2026-07-11").map((note) => note.path)).toEqual(["Notes/dated.md"]);
  });
});
