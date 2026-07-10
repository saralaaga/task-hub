jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  getAllTags: jest.fn(() => []),
  parseFrontMatterTags: jest.fn(() => [])
}), { virtual: true });

import { collectNoteComposerTokens, noteComposerThemeSpec } from "./noteComposer";

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
