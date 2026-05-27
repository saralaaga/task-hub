import { AbstractInputSuggest, type App, getAllTags, parseFrontMatterTags } from "obsidian";
import type { TaskItem } from "../types";

export class TaskHubTagInputSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly getTags: () => string[]
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): string[] {
    const token = tagTokenAtCursor(this.inputEl.value, this.inputEl.selectionStart ?? this.inputEl.value.length) ?? tagTokenFromQuery(query);
    if (!token) return [];
    const needle = normalizeTag(token.text).toLocaleLowerCase();
    return uniqueSortedTags(this.getTags())
      .filter((tag) => normalizeTag(tag).toLocaleLowerCase().startsWith(needle))
      .filter((tag) => normalizeTag(tag) !== normalizeTag(token.text))
      .slice(0, 20);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(normalizeTag(value));
  }

  selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
    evt.preventDefault();
    const cursor = this.inputEl.selectionStart ?? this.inputEl.value.length;
    const next = replaceTagToken(this.inputEl.value, cursor, value);
    this.inputEl.value = next.value;
    this.inputEl.setSelectionRange?.(next.cursor, next.cursor);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.inputEl.dispatchEvent(new CustomEvent("task-hub-tag-selected", { bubbles: true }));
    this.close();
  }
}

export function bindTaskHubTagInputSuggest(app: App, inputEl: HTMLInputElement, getTags: () => string[]): TaskHubTagInputSuggest {
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
