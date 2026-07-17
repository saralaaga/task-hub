jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  getAllTags: jest.fn(() => []),
  parseFrontMatterTags: jest.fn(() => [])
}), { virtual: true });

import { collectNoteComposerTokens, noteComposerThemeSpec, suggestNoteComposerBlocksAtCursor } from "./noteComposer";

describe("collectNoteComposerTokens", () => {
  it("finds task checkbox markers and markdown tags", () => {
    expect(collectNoteComposerTokens("测试\n- [ ] 测试面板 #比赛\n- [x] done #done")).toEqual([
      { type: "checkbox", from: 3, to: 9, checked: false },
      { type: "tag", from: 14, to: 17, text: "#比赛" },
      { type: "checkbox", from: 18, to: 24, checked: true },
      { type: "tag", from: 29, to: 34, text: "#done" }
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
