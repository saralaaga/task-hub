import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  placeholder
} from "@codemirror/view";
import { replaceTagToken, suggestTagsAtCursor } from "./tagInputSuggest";
import { setCssStyles } from "./domStyles";

export type NoteComposerToken =
  | { type: "checkbox"; from: number; to: number; checked: boolean }
  | { type: "tag"; from: number; to: number; text: string }
  | { type: "heading"; from: number; to: number; level: number }
  | { type: "blockquote"; from: number; to: number }
  | { type: "code-block"; from: number; to: number }
  | { type: "strong"; from: number; to: number }
  | { type: "emphasis"; from: number; to: number }
  | { type: "highlight"; from: number; to: number }
  | { type: "strikethrough"; from: number; to: number }
  | { type: "inline-code"; from: number; to: number }
  | { type: "link"; from: number; to: number };

export type TaskHubNoteComposer = {
  readonly view: EditorView;
  destroy: () => void;
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
};

export type TaskHubNoteComposerOptions = {
  parent: HTMLElement;
  value?: string;
  placeholder?: string;
  className?: string;
  extensions?: Extension[];
  tagSuggestions?: () => string[];
  onChange?: (value: string) => void;
  onSubmit?: () => void;
};

type NoteComposerThemeSpec = Parameters<typeof EditorView.theme>[0];
export type NoteComposerTaskDateKind = "start" | "scheduled" | "due";
export type NoteComposerTaskDateSuggestion = {
  kind: "task-date";
  label: string;
  detail: string;
  from: number;
  to: number;
  insert: string;
  cursorOffset: number;
  dateKind: NoteComposerTaskDateKind;
  dateKey: string;
  pickerLabel: string;
};
type NoteComposerSuggestItem =
  | { kind: "tag"; label: string; value: string }
  | { kind: "shortcut"; label: string; detail: string; from: number; to: number; insert: string; cursorOffset: number }
  | NoteComposerTaskDateSuggestion;

const TASK_MARKER = /^(\s*[-*]\s+\[([^\]\r\n])\]\s*)/u;
const TASK_DATE_EMOJI_TRIGGER = /(^|\s)(🛫|⏳|📅)\s*(\d{0,4}(?:-\d{0,2}(?:-\d{0,2})?)?)$/u;
const TASK_DATE_TOKEN = /(?:^|\s)(🛫|⏳|📅)\s*\d{4}-\d{2}-\d{2}(?=\s|$)/gu;
const NOTE_TAG = /(^|[^0-9A-Za-z_/-])(#[\p{L}\p{N}_/-]+)/gu;
const HEADING_LINE = /^(#{1,6})\s+\S.*$/u;
const BLOCKQUOTE_LINE = /^\s*>\s?.*$/u;
const CODE_FENCE_LINE = /^\s*(```|~~~)/u;
const INDENTED_CODE_LINE = /^(?: {4}|\t)\S/u;
const SHORTCUT_TRIGGER = /(^|\s)\/([\p{L}\p{N}_-]*)$/u;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/u;
const INLINE_MARKDOWN_PATTERNS: Array<{
  type: Extract<NoteComposerToken["type"], "strong" | "emphasis" | "highlight" | "strikethrough" | "inline-code" | "link">;
  pattern: RegExp;
  matchIndex?: number;
}> = [
  { type: "inline-code", pattern: /`[^`\n]+`/gu },
  { type: "strong", pattern: /\*\*[^*\n]+?\*\*/gu },
  { type: "highlight", pattern: /==[^=\n]+?==/gu },
  { type: "strikethrough", pattern: /~~[^~\n]+?~~/gu },
  { type: "link", pattern: /\[[^\]\n]+?\]\([^) \n]+?\)/gu },
  { type: "emphasis", pattern: /(^|[^*])(\*[^*\n]+?\*)/gu, matchIndex: 2 }
];
const NOTE_COMPOSER_MIN_HEIGHT = "100px";
const BLOCK_SHORTCUTS: Array<{
  label: string;
  detail: string;
  aliases: string[];
  insert: string;
  cursorOffset: number;
}> = [
  { label: "/quote", detail: "引用块", aliases: ["quote", "blockquote", "引用", "q"], insert: "> ", cursorOffset: 2 },
  { label: "/code", detail: "代码块", aliases: ["code", "代码", "c"], insert: "```\n\n```", cursorOffset: 4 },
  { label: "/todo", detail: "任务", aliases: ["todo", "task", "任务", "t"], insert: "- [ ] ", cursorOffset: 6 },
  { label: "/h1", detail: "一级标题", aliases: ["h1", "标题1", "title"], insert: "# ", cursorOffset: 2 },
  { label: "/h2", detail: "二级标题", aliases: ["h2", "标题2"], insert: "## ", cursorOffset: 3 },
  { label: "/h3", detail: "三级标题", aliases: ["h3", "标题3"], insert: "### ", cursorOffset: 4 }
];
const TASK_DATE_TYPES: Array<{
  kind: NoteComposerTaskDateKind;
  emoji: string;
  label: string;
  aliases: string[];
}> = [
  { kind: "start", emoji: "🛫", label: "开始日期", aliases: ["start", "starts", "begin", "开始", "启动"] },
  { kind: "scheduled", emoji: "⏳", label: "计划日期", aliases: ["scheduled", "schedule", "plan", "planned", "计划", "安排"] },
  { kind: "due", emoji: "📅", label: "截止日期", aliases: ["due", "deadline", "end", "截止", "到期"] }
];

export function noteComposerThemeSpec(): NoteComposerThemeSpec {
  return {
    "&": {
      backgroundColor: "var(--background-primary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "8px",
      boxSizing: "border-box",
      height: "auto",
      minHeight: NOTE_COMPOSER_MIN_HEIGHT,
      overflow: "hidden",
      width: "100%"
    },
    "&.cm-focused": {
      borderColor: "var(--interactive-accent)",
      boxShadow: "0 0 0 2px color-mix(in srgb, var(--interactive-accent) 20%, transparent)",
      outline: "none"
    },
    ".cm-scroller": {
      fontFamily: "var(--font-interface)",
      overflow: "hidden"
    },
    ".cm-content": {
      caretColor: "var(--text-normal)",
      fontFamily: "var(--font-interface)",
      fontSize: "var(--font-ui-medium)",
      lineHeight: "1.45",
      minHeight: NOTE_COMPOSER_MIN_HEIGHT,
      padding: "10px 12px"
    },
    ".cm-content:focus": {
      outline: "none"
    },
    ".cm-line": {
      outline: "none"
    },
    ".cm-placeholder": {
      color: "var(--text-faint)"
    }
  };
}

export function collectNoteComposerTokens(text: string): NoteComposerToken[] {
  const tokens: NoteComposerToken[] = [];
  let lineStart = 0;
  let inFencedCode = false;
  for (const line of text.split(/\n/u)) {
    const isFenceLine = CODE_FENCE_LINE.test(line);
    const isCodeLine = inFencedCode || isFenceLine || INDENTED_CODE_LINE.test(line);
    if (isCodeLine) {
      tokens.push({ type: "code-block", from: lineStart, to: lineStart + line.length });
    } else if (BLOCKQUOTE_LINE.test(line) && line.trim() !== ">") {
      tokens.push({ type: "blockquote", from: lineStart, to: lineStart + line.length });
    }
    const headingMatch = line.match(HEADING_LINE);
    if (headingMatch) {
      tokens.push({
        type: "heading",
        from: lineStart,
        to: lineStart + line.length,
        level: headingMatch[1].length
      });
    }
    const taskMatch = line.match(TASK_MARKER);
    if (taskMatch) {
      tokens.push({
        type: "checkbox",
        from: lineStart + (taskMatch[1] ? taskMatch[1].search(/[-*]/u) : 0),
        to: lineStart + taskMatch[1].length,
        checked: isCompletedTaskStatus(taskMatch[2])
      });
    }
    NOTE_TAG.lastIndex = 0;
    for (const match of line.matchAll(NOTE_TAG)) {
      const start = match.index ?? 0;
      const prefix = match[1] ?? "";
      const tag = match[2] ?? "";
      const from = lineStart + start + prefix.length;
      tokens.push({ type: "tag", from, to: from + tag.length, text: tag });
    }
    if (!isCodeLine) tokens.push(...collectInlineMarkdownTokens(line, lineStart));
    if (isFenceLine) inFencedCode = !inFencedCode;
    lineStart += line.length + 1;
  }
  return tokens.sort((left, right) => left.from - right.from || left.to - right.to);
}

function isCompletedTaskStatus(status: string): boolean {
  return status.toLowerCase() === "x";
}

export function suggestNoteComposerBlocksAtCursor(text: string, cursor: number): NoteComposerSuggestItem[] {
  if (cursor < 0 || cursor > text.length) return [];
  const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const beforeCursor = text.slice(lineStart, cursor);
  const trigger = beforeCursor.match(SHORTCUT_TRIGGER);
  if (!trigger) return [];
  const query = (trigger[2] ?? "").toLocaleLowerCase();
  const triggerStart = lineStart + beforeCursor.length - query.length - 1;
  return BLOCK_SHORTCUTS
    .filter((item) => query.length === 0 || item.aliases.some((alias) => alias.toLocaleLowerCase().startsWith(query)))
    .map((item) => ({
      kind: "shortcut",
      label: item.label,
      detail: item.detail,
      from: triggerStart,
      to: cursor,
      insert: item.insert,
      cursorOffset: item.cursorOffset
    }));
}

export function suggestNoteComposerTaskDatesAtCursor(text: string, cursor: number, now = new Date()): NoteComposerTaskDateSuggestion[] {
  if (cursor < 0 || cursor > text.length) return [];
  const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const lineEndCandidate = text.indexOf("\n", cursor);
  const lineEnd = lineEndCandidate === -1 ? text.length : lineEndCandidate;
  const lineText = text.slice(lineStart, lineEnd);
  const beforeCursor = text.slice(lineStart, cursor);
  if (!TASK_MARKER.test(lineText)) return [];

  const emojiTrigger = beforeCursor.match(TASK_DATE_EMOJI_TRIGGER);
  if (emojiTrigger) {
    const dateType = taskDateTypeFromEmoji(emojiTrigger[2]);
    if (!dateType) return [];
    const triggerStart = lineStart + (emojiTrigger.index ?? 0) + (emojiTrigger[1]?.length ?? 0);
    return buildTaskDateSuggestions(dateType, triggerStart, cursor, emojiTrigger[3] ?? "", now);
  }

  const shortcutTrigger = beforeCursor.match(SHORTCUT_TRIGGER);
  if (!shortcutTrigger) {
    if (text.slice(cursor, lineEnd).trim().length > 0) return [];
    return suggestTaskDateTypesForTaskLine(lineText, cursor, cursor, now, needsSpaceBeforeInsert(beforeCursor) ? " " : "");
  }
  const query = (shortcutTrigger[2] ?? "").toLocaleLowerCase();
  if (!query) return suggestTaskDateTypesForTaskLine(lineText, cursor, cursor, now, " ");
  const triggerStart = lineStart + beforeCursor.length - query.length - 1;
  const shortcutOptions = TASK_DATE_TYPES
    .filter((dateType) => dateType.aliases.some((alias) => alias.toLocaleLowerCase().startsWith(query)))
    .map((dateType) => taskDateSuggestion(dateType, triggerStart, cursor, todayDateKey(now), dateType.label, "今天"));
  if (shortcutOptions.length > 0) return shortcutOptions;
  if (text.slice(cursor, lineEnd).trim().length > 0) return [];
  return suggestTaskDateTypesForTaskLine(lineText, cursor, cursor, now, needsSpaceBeforeInsert(beforeCursor) ? " " : "");
}

export function taskDateSuggestionInsert(kind: NoteComposerTaskDateKind, dateKey: string): string {
  const dateType = TASK_DATE_TYPES.find((candidate) => candidate.kind === kind) ?? TASK_DATE_TYPES[0];
  return `${dateType.emoji} ${dateKey}`;
}

function buildTaskDateSuggestions(
  dateType: (typeof TASK_DATE_TYPES)[number],
  from: number,
  to: number,
  typedDate: string,
  now: Date
): NoteComposerTaskDateSuggestion[] {
  const relativeDates = relativeTaskDateOptions(now);
  const typedDateKey = DATE_KEY.test(typedDate) ? typedDate : undefined;
  const typedSuggestion = typedDateKey && !relativeDates.some((option) => option.dateKey === typedDateKey)
    ? [taskDateSuggestion(dateType, from, to, typedDateKey, "使用输入日期", dateType.label)]
    : [];
  return [
    ...typedSuggestion,
    ...relativeDates.map((option) => taskDateSuggestion(dateType, from, to, option.dateKey, option.label, dateType.label))
  ];
}

function relativeTaskDateOptions(now: Date): Array<{ label: string; dateKey: string }> {
  return [
    { label: "今天", dateKey: addDaysDateKey(now, 0) },
    { label: "明天", dateKey: addDaysDateKey(now, 1) },
    { label: "一周后", dateKey: addDaysDateKey(now, 7) }
  ];
}

function taskDateSuggestion(
  dateType: (typeof TASK_DATE_TYPES)[number],
  from: number,
  to: number,
  dateKey: string,
  label: string,
  detail: string,
  insertPrefix = ""
): NoteComposerTaskDateSuggestion {
  const insert = `${insertPrefix}${taskDateSuggestionInsert(dateType.kind, dateKey)}`;
  return {
    kind: "task-date",
    label,
    detail: `${detail} ${dateKey}`,
    from,
    to,
    insert,
    cursorOffset: insert.length,
    dateKind: dateType.kind,
    dateKey,
    pickerLabel: dateType.label
  };
}

function suggestTaskDateTypesForTaskLine(
  lineText: string,
  from: number,
  to: number,
  now: Date,
  insertPrefix: string
): NoteComposerTaskDateSuggestion[] {
  const existingKinds = taskDateKindsInLine(lineText);
  return TASK_DATE_TYPES
    .filter((dateType) => !existingKinds.has(dateType.kind))
    .map((dateType) => taskDateSuggestion(dateType, from, to, todayDateKey(now), dateType.label, "今天", insertPrefix));
}

function taskDateKindsInLine(lineText: string): Set<NoteComposerTaskDateKind> {
  const kinds = new Set<NoteComposerTaskDateKind>();
  TASK_DATE_TOKEN.lastIndex = 0;
  for (const match of lineText.matchAll(TASK_DATE_TOKEN)) {
    const dateType = taskDateTypeFromEmoji(match[1] ?? "");
    if (dateType) kinds.add(dateType.kind);
  }
  return kinds;
}

function needsSpaceBeforeInsert(beforeCursor: string): boolean {
  return beforeCursor.length > 0 && !/\s$/u.test(beforeCursor);
}

function taskDateTypeFromEmoji(emoji: string): (typeof TASK_DATE_TYPES)[number] | undefined {
  return TASK_DATE_TYPES.find((dateType) => dateType.emoji === emoji);
}

function todayDateKey(now: Date): string {
  return addDaysDateKey(now, 0);
}

function addDaysDateKey(now: Date, days: number): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function collectInlineMarkdownTokens(line: string, lineStart: number): NoteComposerToken[] {
  const tokens: NoteComposerToken[] = [];
  for (const { type, pattern, matchIndex } of INLINE_MARKDOWN_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      const matchedText = match[matchIndex ?? 0] ?? "";
      const matchStart = match.index ?? 0;
      const prefixLength = matchIndex === undefined ? 0 : (match[0]?.indexOf(matchedText) ?? 0);
      const from = lineStart + matchStart + prefixLength;
      tokens.push({ type, from, to: from + matchedText.length } as NoteComposerToken);
    }
  }
  return tokens;
}

export function createTaskHubNoteComposer(options: TaskHubNoteComposerOptions): TaskHubNoteComposer {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onChange?.(update.state.doc.toString());
  });
  const submitKeyHandler = EditorView.domEventHandlers({
    keydown: (event) => {
      if (event.isComposing) return false;
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        options.onSubmit?.();
        return true;
      }
      return false;
    }
  });
  const view = new EditorView({
    state: EditorState.create({
      doc: options.value ?? "",
      extensions: [
        noteComposerDecorations(),
        noteComposerTagSuggest(() => options.tagSuggestions?.() ?? []),
        ...(options.extensions ?? []),
        updateListener,
        submitKeyHandler,
        placeholder(options.placeholder ?? ""),
        EditorView.lineWrapping,
        EditorView.theme(noteComposerThemeSpec())
      ]
    }),
    parent: options.parent
  });
  view.dom.addClass("task-hub-note-composer");
  if (options.className) view.dom.addClass(options.className);
  return {
    view,
    destroy: () => view.destroy(),
    focus: () => view.focus(),
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  };
}

type NoteComposerTagSuggestState = {
  cursor: number;
  options: NoteComposerSuggestItem[];
  selectedIndex: number;
};

function noteComposerTagSuggest(getTags: () => string[]): Extension {
  return ViewPlugin.fromClass(class {
    private popup: HTMLDivElement | undefined;
    private active: NoteComposerTagSuggestState | undefined;
    private scheduledRenderFrame: number | undefined;
    private renderRetryCount = 0;
    private readonly keydownHandler = (event: KeyboardEvent) => {
      if (event.isComposing || !this.active) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectOffset(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectOffset(-1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && this.active.options.length > 0) {
        event.preventDefault();
        this.applySuggestion(this.active.options[this.active.selectedIndex]);
      }
    };
    private readonly focusHandler = () => {
      this.sync();
    };
    private readonly blurHandler = () => {
      this.scheduleRender();
    };

    constructor(private readonly view: EditorView) {
      this.view.dom.addEventListener("keydown", this.keydownHandler);
      this.view.dom.addEventListener("focusin", this.focusHandler);
      this.view.dom.addEventListener("focusout", this.blurHandler);
      this.sync();
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged) {
        this.sync();
      }
    }

    destroy(): void {
      this.view.dom.removeEventListener("keydown", this.keydownHandler);
      this.view.dom.removeEventListener("focusin", this.focusHandler);
      this.view.dom.removeEventListener("focusout", this.blurHandler);
      this.cancelScheduledRender();
      this.close();
    }

    private sync(): void {
      if (!this.isEditorFocused()) {
        this.close();
        return;
      }
      const selection = this.view.state.selection.main;
      if (selection.from !== selection.to) {
        this.close();
        return;
      }
      const cursor = selection.from;
      const text = this.view.state.doc.toString();
      const tagOptions: NoteComposerSuggestItem[] = suggestTagsAtCursor(text, cursor, getTags()).map((value) => ({
        kind: "tag",
        label: value,
        value
      }));
      const dateOptions = suggestNoteComposerTaskDatesAtCursor(text, cursor);
      const options = [...dateOptions, ...suggestNoteComposerBlocksAtCursor(text, cursor), ...tagOptions];
      if (options.length === 0) {
        this.close();
        return;
      }
      const previousLabel = this.active ? this.active.options[this.active.selectedIndex]?.label : undefined;
      const selectedIndex = previousLabel ? Math.max(0, options.findIndex((option) => option.label === previousLabel)) : 0;
      this.active = { cursor, options, selectedIndex };
      this.renderRetryCount = 0;
      this.scheduleRender();
    }

    private ensurePopup(): HTMLDivElement {
      if (this.popup) return this.popup;
      const popup = this.view.dom.ownerDocument.createElement("div");
      popup.className = "task-hub-note-composer-suggest";
      popup.addEventListener("mousedown", (event) => {
        const target = event.target;
        if (target && "closest" in target && typeof target.closest === "function" && target.closest("input")) return;
        event.preventDefault();
      });
      this.popup = popup;
      return popup;
    }

    private render(): void {
      if (!this.active) {
        this.close();
        return;
      }
      if (!this.isEditorFocused()) {
        this.close();
        return;
      }
      const coords = this.view.coordsAtPos(this.active.cursor);
      if (!coords) {
        if (this.renderRetryCount < 2) {
          this.renderRetryCount += 1;
          this.scheduleRender();
          return;
        }
        this.close();
        return;
      }
      this.renderRetryCount = 0;
      const popup = this.ensurePopup();
      popup.replaceChildren();
      const selectedOption = this.active.options[this.active.selectedIndex];
      const dateOption = selectedOption?.kind === "task-date"
        ? selectedOption
        : this.active.options.find((option): option is NoteComposerTaskDateSuggestion => option.kind === "task-date");
      if (dateOption) {
        popup.appendChild(this.renderDatePicker(dateOption));
      }
      for (const [index, option] of this.active.options.entries()) {
        const item = this.view.dom.ownerDocument.createElement("div");
        item.className = `task-hub-note-composer-suggest-item ${index === this.active.selectedIndex ? "is-selected" : ""}`;
        item.createSpan({ cls: "task-hub-note-composer-suggest-label", text: option.label });
        if (option.kind === "shortcut" || option.kind === "task-date") item.createSpan({ cls: "task-hub-note-composer-suggest-detail", text: option.detail });
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          this.applySuggestion(option);
        });
        popup.appendChild(item);
      }
      if (!popup.isConnected) {
        this.view.dom.ownerDocument.body.appendChild(popup);
      }
      setCssStyles(popup, {
        position: "fixed",
        left: `${coords.left}px`,
        top: `${coords.bottom + 6}px`
      });
    }

    private renderDatePicker(option: NoteComposerTaskDateSuggestion): HTMLElement {
      const wrapper = this.view.dom.ownerDocument.createElement("label");
      wrapper.className = "task-hub-note-composer-date-picker";
      wrapper.createSpan({ cls: "task-hub-note-composer-date-picker-label", text: option.pickerLabel });
      const input = wrapper.createEl("input", {
        cls: "task-hub-note-composer-date-picker-input",
        type: "date",
        value: option.dateKey
      });
      input.addEventListener("mousedown", (event) => event.stopPropagation());
      input.addEventListener("click", () => {
        try {
          input.showPicker?.();
        } catch {
          input.focus();
        }
      });
      input.addEventListener("change", () => {
        if (!DATE_KEY.test(input.value)) return;
        this.applyTaskDate(option, input.value);
      });
      return wrapper;
    }

    private selectOffset(offset: number): void {
      if (!this.active) return;
      const length = this.active.options.length;
      this.active = {
        ...this.active,
        selectedIndex: (this.active.selectedIndex + offset + length) % length
      };
      this.render();
    }

    private applySuggestion(option: NoteComposerSuggestItem): void {
      if (option.kind === "tag") {
        const next = replaceTagToken(this.view.state.doc.toString(), this.active?.cursor ?? this.view.state.selection.main.from, option.value);
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: next.value },
          selection: { anchor: next.cursor },
          userEvent: "input.complete"
        });
      } else if (option.kind === "shortcut" || option.kind === "task-date") {
        this.view.dispatch({
          changes: { from: option.from, to: option.to, insert: option.insert },
          selection: { anchor: option.from + option.cursorOffset },
          userEvent: "input.complete"
        });
      }
      this.view.focus();
      this.sync();
    }

    private applyTaskDate(option: NoteComposerTaskDateSuggestion, dateKey: string): void {
      const insert = taskDateSuggestionInsert(option.dateKind, dateKey);
      this.view.dispatch({
        changes: { from: option.from, to: option.to, insert },
        selection: { anchor: option.from + insert.length },
        userEvent: "input.complete"
      });
      this.view.focus();
      this.sync();
    }

    private isEditorFocused(): boolean {
      const activeElement = this.view.dom.ownerDocument.activeElement;
      return this.view.hasFocus || Boolean(activeElement && (this.view.dom.contains(activeElement) || this.popup?.contains(activeElement)));
    }

    private scheduleRender(): void {
      this.cancelScheduledRender();
      const win = this.view.dom.ownerDocument.defaultView;
      if (!win) {
        this.render();
        return;
      }
      this.scheduledRenderFrame = win.requestAnimationFrame(() => {
        this.scheduledRenderFrame = undefined;
        this.render();
      });
    }

    private cancelScheduledRender(): void {
      const win = this.view.dom.ownerDocument.defaultView;
      if (win && this.scheduledRenderFrame !== undefined) {
        win.cancelAnimationFrame(this.scheduledRenderFrame);
      }
      this.scheduledRenderFrame = undefined;
    }

    private close(): void {
      this.cancelScheduledRender();
      this.renderRetryCount = 0;
      this.active = undefined;
      this.popup?.remove();
      this.popup = undefined;
    }
  });
}

function noteComposerDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildNoteComposerDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildNoteComposerDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildNoteComposerDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of collectNoteComposerTokens(view.state.doc.toString())) {
    if (token.type === "checkbox") {
      builder.add(
        token.from,
        token.to,
        Decoration.replace({
          widget: new NoteComposerCheckboxWidget(token.from, token.to, token.checked)
        })
      );
    } else if (token.type === "tag") {
      builder.add(token.from, token.to, Decoration.mark({ class: "task-hub-task-tag task-hub-note-composer-tag" }));
    } else if (token.type === "heading") {
      builder.add(token.from, token.to, Decoration.mark({ class: `task-hub-note-composer-heading task-hub-note-composer-heading-${token.level}` }));
    } else if (token.type === "blockquote" || token.type === "code-block") {
      builder.add(token.from, token.from, Decoration.line({ attributes: { class: `task-hub-note-composer-${token.type}-line` } }));
    } else {
      builder.add(token.from, token.to, Decoration.mark({ class: `task-hub-note-composer-${token.type}` }));
    }
  }
  return builder.finish();
}

class NoteComposerCheckboxWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly checked: boolean
  ) {
    super();
  }

  eq(other: NoteComposerCheckboxWidget): boolean {
    return this.from === other.from && this.to === other.to && this.checked === other.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.className = "task-hub-note-composer-checkbox";
    input.type = "checkbox";
    input.checked = this.checked;
    input.tabIndex = -1;
    input.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    input.addEventListener("focus", () => {
      view.focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        view.focus();
      }
    });
    input.addEventListener("click", (event) => {
      event.preventDefault();
      const currentMarker = view.state.sliceDoc(this.from, this.to);
      const nextMarker = currentMarker.replace(/\[[^\]\r\n]\]/u, this.checked ? "[ ]" : "[x]");
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextMarker } });
      view.focus();
    });
    return input;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
