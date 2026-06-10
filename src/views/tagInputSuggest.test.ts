jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {
    suggestEl = {
      classes: new Set<string>(),
      classList: {
        add: (cls: string) => this.suggestEl.classes.add(cls)
      }
    };

    constructor(public app: unknown, public inputEl: HTMLInputElement | HTMLTextAreaElement) {}
    close(): void {}
  },
  getAllTags: jest.fn(() => ["#vault", "#project/acme"]),
  parseFrontMatterTags: jest.fn(() => ["frontmatter"])
}), { virtual: true });

import { collectObsidianTags, replaceTagToken, tagTokenAtCursor, TaskHubTagInputSuggest } from "./tagInputSuggest";
import type { TaskItem } from "../types";

class FakeEvent {
  constructor(
    readonly type: string,
    readonly options: { bubbles?: boolean } = {}
  ) {}
}

class FakeCustomEvent extends FakeEvent {}

beforeAll(() => {
  Object.assign(globalThis, {
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent
  });
});

describe("tagInputSuggest", () => {
  it("finds the hash tag token at the cursor", () => {
    expect(tagTokenAtCursor("Call #比 today", 7)).toEqual({ text: "#比", start: 5, end: 7 });
  });

  it("replaces the current tag token while preserving surrounding text", () => {
    expect(replaceTagToken("Call #比 today", 7, "#比赛/报名")).toEqual({
      value: "Call #比赛/报名 today",
      cursor: 11
    });
  });

  it("appends a tag when the cursor is not in a tag token", () => {
    expect(replaceTagToken("Call client", 4, "work")).toEqual({
      value: "Call client #work",
      cursor: 17
    });
  });

  it("collects vault, frontmatter, and task tags for suggestions", () => {
    const task = { tags: ["#task"] } as TaskItem;
    const app = {
      vault: { getMarkdownFiles: () => [{ path: "Inbox.md" }] },
      metadataCache: { getFileCache: () => ({}) }
    };

    expect(collectObsidianTags(app as never, [task])).toEqual(["#frontmatter", "#project/acme", "#task", "#vault"]);
  });

  it("uses the current hash token to return matching native input suggestions", () => {
    const input = fakeInput();
    input.value = "#比";
    input.setSelectionRange(2, 2);
    const suggest = new TaskHubTagInputSuggest({} as never, input, () => ["#比赛", "#比赛/报名", "#生活"]);

    expect(suggest.getSuggestions("")).toEqual(["#比赛", "#比赛/报名"]);
  });

  it("matches nested tag path segments when suggesting tags", () => {
    const input = fakeInput();
    input.value = "#天香居";
    input.setSelectionRange(4, 4);
    const suggest = new TaskHubTagInputSuggest({} as never, input, () => ["#p/天香居", "#天香居", "#p/别处"]);

    expect(suggest.getSuggestions("")).toEqual(["#p/天香居"]);
  });

  it("marks the native suggest container for Task Hub layering", () => {
    const suggest = new TaskHubTagInputSuggest({} as never, fakeInput(), () => []);

    expect((suggest as unknown as { suggestEl: { classes: Set<string> } }).suggestEl.classes.has("task-hub-tag-suggest")).toBe(true);
  });

  it("shows existing tags when only the hash marker has been typed", () => {
    const input = fakeInput();
    input.value = "#";
    input.setSelectionRange(1, 1);
    const suggest = new TaskHubTagInputSuggest({} as never, input, () => ["#work", "#p/论文/选题"]);

    expect(suggest.getSuggestions("")).toEqual(["#p/论文/选题", "#work"]);
  });

  it("writes the selected suggestion back to the input and dispatches input", () => {
    const input = fakeInput();
    const onInput = jest.fn();
    input.value = "Do #比 now";
    input.setSelectionRange(5, 5);
    input.addEventListener("input", onInput);
    const suggest = new TaskHubTagInputSuggest({} as never, input, () => ["#比赛/报名"]);

    suggest.selectSuggestion("#比赛/报名", { preventDefault: jest.fn() } as never);

    expect(input.value).toBe("Do #比赛/报名 now");
    expect(input.selectionStart).toBe(9);
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("dispatches a tag selected event after choosing a suggestion", () => {
    const input = fakeInput();
    const onTagSelected = jest.fn();
    input.value = "#比";
    input.setSelectionRange(2, 2);
    input.addEventListener("task-hub-tag-selected", onTagSelected);
    const suggest = new TaskHubTagInputSuggest({} as never, input, () => ["#比赛"]);

    suggest.selectSuggestion("#比赛", { preventDefault: jest.fn() } as never);

    expect(onTagSelected).toHaveBeenCalledTimes(1);
  });

  it("supports textarea note editors", () => {
    const textarea = fakeInput() as unknown as HTMLTextAreaElement;
    const onInput = jest.fn();
    textarea.value = "写一点 #项";
    textarea.setSelectionRange(5, 5);
    textarea.addEventListener("input", onInput);
    const suggest = new TaskHubTagInputSuggest({} as never, textarea, () => ["#项目/灯光"]);

    expect(suggest.getSuggestions("")).toEqual(["#项目/灯光"]);
    suggest.selectSuggestion("#项目/灯光", { preventDefault: jest.fn() } as never);

    expect(textarea.value).toBe("写一点 #项目/灯光");
    expect(onInput).toHaveBeenCalledTimes(1);
  });
});

function fakeInput(): HTMLInputElement {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  return {
    value: "",
    selectionStart: 0,
    setSelectionRange(start: number) {
      this.selectionStart = start;
    },
    addEventListener(name: string, listener: (event: Event) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    dispatchEvent(event: Event) {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    }
  } as unknown as HTMLInputElement;
}
