import { AbstractInputSuggest, type App, getAllTags, parseFrontMatterTags } from "obsidian";
import type { TaskItem } from "../types";
import { setCssStyles } from "./domStyles";

export type TaskHubTagInputElement = HTMLInputElement | HTMLTextAreaElement;

export class TaskHubTagInputSuggest extends AbstractInputSuggest<string> {
  private readonly sourceEl: TaskHubTagInputElement;
  private readonly originalGetBoundingClientRect?: () => DOMRect;

  constructor(
    app: App,
    inputEl: TaskHubTagInputElement,
    private readonly getTags: () => string[]
  ) {
    let originalGetBoundingClientRect: (() => DOMRect) | undefined;
    if (isTextareaElement(inputEl)) {
      const original = inputEl.getBoundingClientRect.bind(inputEl);
      originalGetBoundingClientRect = original;
      inputEl.getBoundingClientRect = () => textareaCaretViewportRect(inputEl, original);
    }
    super(app, inputEl as HTMLInputElement);
    tagSuggestElement(this)?.classList.add("task-hub-tag-suggest");
    this.sourceEl = inputEl;
    this.originalGetBoundingClientRect = originalGetBoundingClientRect;
  }

  getSuggestions(query: string): string[] {
    const token = tagTokenAtCursor(this.sourceEl.value, this.sourceEl.selectionStart ?? this.sourceEl.value.length) ?? tagTokenFromQuery(query);
    if (!token) return [];
    const needle = normalizeTag(token.text).toLocaleLowerCase();
    return uniqueSortedTags(this.getTags())
      .filter((tag) => isTagSuggestionMatch(tag, needle))
      .filter((tag) => normalizeTag(tag) !== normalizeTag(token.text))
      .slice(0, 20);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(normalizeTag(value));
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    evt.preventDefault();
    const cursor = this.sourceEl.selectionStart ?? this.sourceEl.value.length;
    const next = replaceTagToken(this.sourceEl.value, cursor, value);
    this.sourceEl.value = next.value;
    this.sourceEl.setSelectionRange?.(next.cursor, next.cursor);
    this.sourceEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.sourceEl.dispatchEvent(new CustomEvent("task-hub-tag-selected", { bubbles: true }));
    this.close();
  }

  destroy(): void {
    super.close();
    if (this.originalGetBoundingClientRect) {
      this.sourceEl.getBoundingClientRect = this.originalGetBoundingClientRect;
    }
  }
}

export function bindTaskHubTagInputSuggest(app: App, inputEl: TaskHubTagInputElement, getTags: () => string[]): TaskHubTagInputSuggest {
  return new TaskHubTagInputSuggest(app, inputEl, getTags);
}

export function collectObsidianTags(app: App, tasks: TaskItem[]): string[] {
  const tags = new Set(tasks.flatMap((task) => task.tags));
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    for (const tag of getAllTags(cache ?? {}) ?? []) {
      tags.add(withHash(tag));
    }
    for (const tag of parseFrontMatterTags(cache?.frontmatter ?? null) ?? []) {
      tags.add(withHash(tag));
    }
  }
  return uniqueSortedTags([...tags]);
}

export function tagTokenAtCursor(value: string, cursor: number): { text: string; start: number; end: number } | undefined {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const prefix = value.slice(0, safeCursor);
  const match = prefix.match(/(^|\s)(#[^\s#]*)$/u);
  if (!match?.[2]) return undefined;
  const start = prefix.length - match[2].length;
  const suffix = value.slice(safeCursor);
  const endOffset = suffix.match(/^[^\s#]*/u)?.[0].length ?? 0;
  return { text: match[2], start, end: safeCursor + endOffset };
}

export function replaceTagToken(value: string, cursor: number, replacement: string): { value: string; cursor: number } {
  const token = tagTokenAtCursor(value, cursor);
  const tag = withHash(replacement);
  if (!token) {
    const prefix = value && !/\s$/u.test(value) ? `${value} ` : value;
    const nextValue = `${prefix}${tag}`;
    return { value: nextValue, cursor: nextValue.length };
  }
  const nextValue = `${value.slice(0, token.start)}${tag}${value.slice(token.end)}`;
  return { value: nextValue, cursor: token.start + tag.length };
}

function tagTokenFromQuery(query: string): { text: string; start: number; end: number } | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;
  return { text: withHash(trimmed), start: 0, end: trimmed.length };
}

function uniqueSortedTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(withHash).filter((tag) => normalizeTag(tag)))).sort((left, right) => left.localeCompare(right));
}

function withHash(tag: string): string {
  const normalized = normalizeTag(tag);
  return normalized ? `#${normalized}` : "";
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/u, "");
}

function isTagSuggestionMatch(tag: string, needle: string): boolean {
  const normalized = normalizeTag(tag).toLocaleLowerCase();
  if (normalized.startsWith(needle)) return true;
  return normalized.split("/").some((part) => part.startsWith(needle));
}

function isTextareaElement(inputEl: TaskHubTagInputElement): inputEl is HTMLTextAreaElement {
  return inputEl.tagName === "TEXTAREA";
}

function tagSuggestElement(suggest: AbstractInputSuggest<string>): HTMLElement | undefined {
  return (suggest as AbstractInputSuggest<string> & { suggestEl?: HTMLElement }).suggestEl;
}

function textareaCaretViewportRect(textarea: HTMLTextAreaElement, originalRect: () => DOMRect): DOMRect {
  const style = textarea.win.getComputedStyle(textarea);
  const ownerDocument = textarea.doc;
  const mirror = ownerDocument.createElement("div");
  mirror.className = "task-hub-textarea-caret-mirror";
  const properties = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "textTransform",
    "whiteSpace",
    "wordBreak",
    "wordSpacing",
    "wordWrap"
  ] as const;
  const mirrorStyles = Object.fromEntries(properties.map((property) => [property, style[property]])) as Partial<CSSStyleDeclaration>;
  setCssStyles(mirror, {
    ...mirrorStyles,
    left: "-9999px",
    overflow: "hidden",
    position: "fixed",
    top: "0",
    width: `${textarea.clientWidth}px`
  });
  mirror.textContent = textarea.value.slice(0, textarea.selectionStart ?? textarea.value.length);
  const marker = ownerDocument.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  ownerDocument.body.append(mirror);
  const markerRect = marker.getBoundingClientRect();
  const textareaRect = originalRect();
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || 20;
  const left = Math.min(Math.max(markerRect.left - textarea.scrollLeft, textareaRect.left), textareaRect.right - 8);
  const top = Math.min(Math.max(markerRect.top - textarea.scrollTop, textareaRect.top), textareaRect.bottom - lineHeight);
  mirror.remove();
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + 1,
    bottom: top + lineHeight,
    width: 1,
    height: lineHeight,
    toJSON: () => ({})
  } as DOMRect;
}
