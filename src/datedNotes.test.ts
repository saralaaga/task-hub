import {
  applyDatedNoteTitleTemplate,
  createDatedNoteContent,
  DatedNoteIndex,
  datedNoteTitleFromBody,
  parseDatedNoteFrontmatter,
  replaceDatedNoteBody
} from "./datedNotes";

describe("dated notes", () => {
  it("creates Task Hub note frontmatter with a date", () => {
    const content = createDatedNoteContent({
      noteId: "note_202607071030_abcd",
      date: "2026-07-07",
      title: "Morning note",
      createdAt: "2026-07-07T10:30:00.000Z"
    });

    expect(content).toContain("taskhub-type: note");
    expect(content).toContain('taskhub-note-id: "note_202607071030_abcd"');
    expect(content).toContain("taskhub-date: 2026-07-07");
    expect(content).toContain('# Morning note');
    expect(content).not.toContain("task-hub-note");
    expect(parseDatedNoteFrontmatter(content)?.tags).toEqual([]);
  });

  it("keeps multiline note body content and derives a title from the first line", () => {
    const body = "今天推进了笔记功能\n\n- 可以多行输入\n- YAML 仍然记录日期";
    const content = createDatedNoteContent({
      noteId: "note_202607071031_abcd",
      date: "2026-07-07",
      title: datedNoteTitleFromBody(body) ?? "Fallback",
      createdAt: "2026-07-07T10:31:00.000Z",
      body
    });

    expect(content).toContain('title: "今天推进了笔记功能"');
    expect(content).toContain("今天推进了笔记功能\n\n- 可以多行输入\n- YAML 仍然记录日期");
    expect(parseDatedNoteFrontmatter(content)).toMatchObject({
      title: "今天推进了笔记功能",
      body
    });
  });

  it("parses canonical and compatible note metadata", () => {
    expect(parseDatedNoteFrontmatter(`---
taskhub-type: note
taskhub-note-id: "note_1"
taskhub-date: 2026-07-07
title: "Morning"
taskhub-created: 2026-07-07T08:00:00.000Z
tags:
  - life
---
# Body title
Text #inline
`)).toMatchObject({
      noteId: "note_1",
      date: "2026-07-07",
      title: "Morning",
      tags: ["#life", "#inline"],
      createdAt: "2026-07-07T08:00:00.000Z"
    });

    expect(parseDatedNoteFrontmatter(`---
taskHubType: note
noteId: note-demo
date: 2026-07-08
createdAt: 2026-07-08T09:00:00.000Z
---
# Compatible
`)).toMatchObject({
      noteId: "note-demo",
      date: "2026-07-08",
      title: "Compatible",
      createdAt: "2026-07-08T09:00:00.000Z"
    });
  });

  it("replaces a dated note body while preserving and refreshing frontmatter", () => {
    const content = createDatedNoteContent({
      noteId: "note_202607071031_abcd",
      date: "2026-07-07",
      title: "Old title",
      createdAt: "2026-07-07T10:31:00.000Z",
      body: "Old body"
    });

    const result = replaceDatedNoteBody(content, "新标题\n- [ ] 新任务", "2026-07-07T11:00:00.000Z");

    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("Expected update");
    expect(result.content).toContain('taskhub-note-id: "note_202607071031_abcd"');
    expect(result.content).toContain("taskhub-date: 2026-07-07");
    expect(result.content).toContain('title: "新标题"');
    expect(result.content).toContain("taskhub-updated: 2026-07-07T11:00:00.000Z");
    expect(parseDatedNoteFrontmatter(result.content)).toMatchObject({
      title: "新标题",
      body: "新标题\n- [ ] 新任务",
      updatedAt: "2026-07-07T11:00:00.000Z"
    });
  });

  it("indexes only dated Task Hub notes and sorts same-day notes by created time", async () => {
    const files = new Map([
      ["Notes/late.md", `---
taskhub-type: note
taskhub-date: 2026-07-07
title: Late
taskhub-created: 2026-07-07T22:00:00.000Z
---
Late body
`],
      ["Notes/early.md", `---
taskhub-type: note
taskhub-date: 2026-07-07
title: Early
taskhub-created: 2026-07-07T08:00:00.000Z
---
Early body
`],
      ["Tasks.md", "- [ ] not a note"]
    ]);
    const index = new DatedNoteIndex({
      ignoredPaths: [],
      readFile: (file) => files.get(file.path) ?? ""
    });

    await index.scanFiles(
      Array.from(files.keys()).map((path) => ({
        path,
        extension: "md",
        stat: { ctime: 1, mtime: 1, size: files.get(path)?.length ?? 0 }
      }))
    );

    expect(index.getNotes().map((note) => note.title)).toEqual(["Late", "Early"]);
    expect(index.getNotesForDate("2026-07-07").map((note) => note.path)).toEqual(["Notes/late.md", "Notes/early.md"]);
  });

  it("applies date title templates", () => {
    expect(applyDatedNoteTitleTemplate("YYYY-MM-DD 笔记", "2026-07-07")).toBe("2026-07-07 笔记");
    expect(applyDatedNoteTitleTemplate("YYYY/MM/DD", "2026-07-07")).toBe("2026/07/07");
  });
});
