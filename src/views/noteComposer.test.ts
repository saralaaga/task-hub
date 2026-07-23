jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  getAllTags: jest.fn(() => []),
  parseFrontMatterTags: jest.fn(() => [])
}), { virtual: true });

import {
  collectNoteComposerTokens,
  editNoteComposerDateInputSegment,
  formatNoteComposerDateInput,
  moveNoteComposerDateInputSegment,
  noteComposerDateSegmentRange,
  noteComposerThemeSpec,
  parseNoteComposerDateInput,
  suggestNoteComposerBlocksAtCursor,
  suggestNoteComposerTaskDatesAtCursor,
  taskDateSuggestionInsert
} from "./noteComposer";

describe("collectNoteComposerTokens", () => {
  it("finds task checkbox markers and markdown tags", () => {
    expect(collectNoteComposerTokens("测试\n- [ ] 测试面板 #比赛\n- [x] done #done")).toEqual([
      { type: "checkbox", from: 3, to: 9, checked: false },
      { type: "tag", from: 14, to: 17, text: "#比赛" },
      { type: "checkbox", from: 18, to: 24, checked: true },
      { type: "tag", from: 29, to: 34, text: "#done" }
    ]);
  });

  it("finds Tasks plugin custom checkbox statuses", () => {
    expect(collectNoteComposerTokens("- [/] doing\n- [?] waiting\n- [-] cancelled")).toEqual([
      { type: "checkbox", from: 0, to: 6, checked: false },
      { type: "checkbox", from: 12, to: 18, checked: false },
      { type: "checkbox", from: 26, to: 32, checked: false }
    ]);
  });

  it("does not treat hash characters in the middle of words as tags", () => {
    expect(collectNoteComposerTokens("abc#not-tag #tag")).toEqual([
      { type: "tag", from: 12, to: 16, text: "#tag" }
    ]);
  });

  it("finds inline Chinese tags without requiring a preceding space", () => {
    expect(collectNoteComposerTokens("今天#项目复盘 明天继续")).toEqual([
      { type: "tag", from: 2, to: 7, text: "#项目复盘" }
    ]);
  });

  it("finds basic markdown style spans for live note composer rendering", () => {
    expect(collectNoteComposerTokens("# H1\n## H2\n**bold** *em* ==mark== ~~gone~~ `code` [link](https://example.com)")).toEqual([
      { type: "heading", from: 0, to: 4, level: 1 },
      { type: "heading", from: 5, to: 10, level: 2 },
      { type: "strong", from: 11, to: 19 },
      { type: "emphasis", from: 20, to: 24 },
      { type: "highlight", from: 25, to: 33 },
      { type: "strikethrough", from: 34, to: 42 },
      { type: "inline-code", from: 43, to: 49 },
      { type: "link", from: 50, to: 77 }
    ]);
  });

  it("finds blockquote and code block lines for live note composer rendering", () => {
    expect(collectNoteComposerTokens("> 引用\n    缩进代码\n```\n围栏代码\n```")).toEqual([
      { type: "blockquote", from: 0, to: 4 },
      { type: "code-block", from: 5, to: 13 },
      { type: "code-block", from: 14, to: 17 },
      { type: "code-block", from: 18, to: 22 },
      { type: "code-block", from: 23, to: 26 }
    ]);
  });
});

describe("suggestNoteComposerBlocksAtCursor", () => {
  it("suggests block shortcuts from slash input", () => {
    expect(suggestNoteComposerBlocksAtCursor("/q", 2).map((item) => item.label)).toEqual(["/quote"]);
    expect(suggestNoteComposerBlocksAtCursor("今天 /引", 5).map((item) => item.label)).toEqual(["/quote"]);
  });

  it("does not suggest block shortcuts away from the cursor trigger", () => {
    expect(suggestNoteComposerBlocksAtCursor("正文 /quote 后续", 12)).toEqual([]);
  });
});

describe("suggestNoteComposerTaskDatesAtCursor", () => {
  const now = new Date("2026-07-20T12:00:00");

  it("suggests the three supported task date tokens from slash aliases", () => {
    const startText = "- [ ] 写计划 /st";
    const scheduledText = "- [ ] 写计划 /sch";
    const dueText = "- [ ] 写计划 /du";
    expect(suggestNoteComposerTaskDatesAtCursor(startText, startText.length, now)).toMatchObject([
      { kind: "task-date", dateKind: "start", insert: "🛫 2026-07-20", label: "开始日期" }
    ]);
    expect(suggestNoteComposerTaskDatesAtCursor(scheduledText, scheduledText.length, now)).toMatchObject([
      { kind: "task-date", dateKind: "scheduled", insert: "⏳ 2026-07-20", label: "计划日期" }
    ]);
    expect(suggestNoteComposerTaskDatesAtCursor(dueText, dueText.length, now)).toMatchObject([
      { kind: "task-date", dateKind: "due", insert: "📅 2026-07-20", label: "截止日期" }
    ]);
  });

  it("shows relative date choices after a task date emoji", () => {
    const text = "- [ ] 写计划 ⏳";
    expect(suggestNoteComposerTaskDatesAtCursor(text, text.length, now)).toMatchObject([
      { dateKind: "scheduled", label: "今天", insert: "⏳ 2026-07-20" },
      { dateKind: "scheduled", label: "明天", insert: "⏳ 2026-07-21" },
      { dateKind: "scheduled", label: "一周后", insert: "⏳ 2026-07-27" }
    ]);
  });

  it("shows date type choices when the cursor is at the end of a task line", () => {
    const text = "- [ ] 测试";
    expect(suggestNoteComposerTaskDatesAtCursor(text, text.length, now)).toMatchObject([
      { dateKind: "start", label: "开始日期", insert: " 🛫 2026-07-20" },
      { dateKind: "scheduled", label: "计划日期", insert: " ⏳ 2026-07-20" },
      { dateKind: "due", label: "截止日期", insert: " 📅 2026-07-20" }
    ]);
  });

  it("does not repeat date types already present on the task line", () => {
    const text = "- [ ] 测试 🛫 2026-07-20 ";
    expect(suggestNoteComposerTaskDatesAtCursor(text, text.length, now).map((item) => item.dateKind)).toEqual(["scheduled", "due"]);
  });

  it("keeps a typed custom date as the first date choice", () => {
    const text = "- [ ] 写计划 📅 2026-08-03";
    expect(suggestNoteComposerTaskDatesAtCursor(text, text.length, now).slice(0, 2)).toMatchObject([
      { dateKind: "due", label: "使用输入日期", insert: "📅 2026-08-03" },
      { dateKind: "due", label: "今天", insert: "📅 2026-07-20" }
    ]);
  });

  it("does not suggest task dates outside task lines", () => {
    const text = "普通笔记 📅";
    expect(suggestNoteComposerTaskDatesAtCursor(text, text.length, now)).toEqual([]);
  });
});

describe("taskDateSuggestionInsert", () => {
  it("formats the supported date kinds as Tasks-compatible emoji tokens", () => {
    expect(taskDateSuggestionInsert("start", "2026-07-20")).toBe("🛫 2026-07-20");
    expect(taskDateSuggestionInsert("scheduled", "2026-07-20")).toBe("⏳ 2026-07-20");
    expect(taskDateSuggestionInsert("due", "2026-07-20")).toBe("📅 2026-07-20");
  });
});

describe("note composer date picker input helpers", () => {
  it("formats and parses editable date text", () => {
    expect(formatNoteComposerDateInput("2026-07-27")).toBe("2026/07/27");
    expect(parseNoteComposerDateInput("2026/7/2")).toBe("2026-07-02");
    expect(parseNoteComposerDateInput("2026-07-27")).toBe("2026-07-27");
  });

  it("rejects invalid editable date text", () => {
    expect(parseNoteComposerDateInput("2026/02/30")).toBeUndefined();
    expect(parseNoteComposerDateInput("2026/13/01")).toBeUndefined();
    expect(parseNoteComposerDateInput("tomorrow")).toBeUndefined();
  });

  it("moves between year, month, and day segments", () => {
    expect(noteComposerDateSegmentRange(9)).toEqual({ start: 8, end: 10 });
    expect(noteComposerDateSegmentRange(9, "left")).toEqual({ start: 5, end: 7 });
    expect(noteComposerDateSegmentRange(6, "left")).toEqual({ start: 0, end: 4 });
    expect(noteComposerDateSegmentRange(1, "right")).toEqual({ start: 5, end: 7 });
    expect(noteComposerDateSegmentRange(6, "right")).toEqual({ start: 8, end: 10 });
  });

  it("edits only the selected date segment when typing digits", () => {
    const firstDigit = editNoteComposerDateInputSegment("2026/07/20", 2, undefined, "3");
    expect(firstDigit).toEqual({ segmentBuffer: "3", segmentIndex: 2, value: "2026/07/3" });

    const secondDigit = editNoteComposerDateInputSegment(firstDigit.value, firstDigit.segmentIndex, firstDigit.segmentBuffer, "1");
    expect(secondDigit).toEqual({ segmentBuffer: "31", segmentIndex: 2, value: "2026/07/31" });

    const replacementDigit = editNoteComposerDateInputSegment(secondDigit.value, secondDigit.segmentIndex, secondDigit.segmentBuffer, "2");
    expect(replacementDigit).toEqual({ segmentBuffer: "2", segmentIndex: 2, value: "2026/07/2" });
  });

  it("moves editable date input selection between segments and resets typed buffers", () => {
    expect(moveNoteComposerDateInputSegment("2026/07/20", 2, "left")).toEqual({
      range: { start: 5, end: 7 },
      segmentBuffer: "",
      segmentIndex: 1,
      value: "2026/07/20"
    });
    expect(moveNoteComposerDateInputSegment("2026/07/20", 1, "right")).toEqual({
      range: { start: 8, end: 10 },
      segmentBuffer: "",
      segmentIndex: 2,
      value: "2026/07/20"
    });
  });
});

describe("noteComposerThemeSpec", () => {
  it("keeps the runtime CodeMirror editor styled as a rounded four-line input", () => {
    expect(noteComposerThemeSpec()).toMatchObject({
      "&": {
        borderRadius: "8px",
        height: "auto",
        minHeight: "100px",
        overflow: "hidden",
        width: "100%"
      },
      "&.cm-focused": {
        outline: "none"
      },
      ".cm-scroller": {
        overflow: "hidden"
      },
      ".cm-content": {
        minHeight: "100px"
      },
      ".cm-content:focus": {
        outline: "none"
      },
      ".cm-line": {
        outline: "none"
      }
    });
  });
});
