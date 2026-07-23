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
type NoteComposerDateSegmentIndex = 0 | 1 | 2;
export type NoteComposerDateInputEditState = {
  segmentBuffer: string;
  segmentIndex: NoteComposerDateSegmentIndex;
  value: string;
};
type NoteComposerSuggestItem =
  | { kind: "enter"; label: string; detail: string }
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
const DATE_PICKER_TEXT = /^\s*(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s*$/u;
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
const DATE_PICKER_SELECTION_INDEX = -1;
const NOTE_COMPOSER_ENTER_SUGGESTION: Extract<NoteComposerSuggestItem, { kind: "enter" }> = {
  kind: "enter",
  label: "↵",
  detail: "换行"
};
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

export function formatNoteComposerDateInput(dateKey: string): string {
  return dateKey.replace(/-/gu, "/");
}

export function parseNoteComposerDateInput(value: string): string | undefined {
  const match = value.match(DATE_PICKER_TEXT);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function noteComposerDateSegmentRange(cursor: number, direction: "left" | "right" | "current" = "current"): { start: number; end: number } {
  const ranges = [
    { start: 0, end: 4 },
    { start: 5, end: 7 },
    { start: 8, end: 10 }
  ];
  const currentIndex = ranges.findIndex((range) => cursor <= range.end);
  const safeIndex = currentIndex === -1 ? ranges.length - 1 : currentIndex;
  const nextIndex = direction === "left"
    ? Math.max(0, safeIndex - 1)
    : direction === "right"
      ? Math.min(ranges.length - 1, safeIndex + 1)
      : safeIndex;
  return ranges[nextIndex];
}

function dateInputParts(value: string): [string, string, string] {
  const parts = value.match(/\d+/gu) ?? [];
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

function dateInputTextFromParts(parts: [string, string, string]): string {
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function dateInputSegmentRange(value: string, segmentIndex: NoteComposerDateSegmentIndex): { start: number; end: number } {
  const parts = dateInputParts(value);
  const yearStart = 0;
  const monthStart = parts[0].length + 1;
  const dayStart = monthStart + parts[1].length + 1;
  if (segmentIndex === 0) return { start: yearStart, end: yearStart + parts[0].length };
  if (segmentIndex === 1) return { start: monthStart, end: monthStart + parts[1].length };
  return { start: dayStart, end: dayStart + parts[2].length };
}

function dateInputSegmentIndexAtCursor(value: string, cursor: number): NoteComposerDateSegmentIndex {
  const parts = dateInputParts(value);
  const monthStart = parts[0].length + 1;
  const dayStart = monthStart + parts[1].length + 1;
  if (cursor < monthStart) return 0;
  if (cursor < dayStart) return 1;
  return 2;
}

function nextDateInputSegmentIndex(index: NoteComposerDateSegmentIndex, direction: "left" | "right" | "current"): NoteComposerDateSegmentIndex {
  if (direction === "left") return Math.max(0, index - 1) as NoteComposerDateSegmentIndex;
  if (direction === "right") return Math.min(2, index + 1) as NoteComposerDateSegmentIndex;
  return index;
}

export function editNoteComposerDateInputSegment(
  value: string,
  segmentIndex: NoteComposerDateSegmentIndex,
  segmentBuffer: string | undefined,
  digit: string
): NoteComposerDateInputEditState {
  const maxLength = segmentIndex === 0 ? 4 : 2;
  const currentBuffer = segmentBuffer ?? "";
  const nextBuffer = currentBuffer.length >= maxLength ? digit : `${currentBuffer}${digit}`;
  const parts = dateInputParts(value);
  parts[segmentIndex] = nextBuffer;
  return {
    segmentBuffer: nextBuffer,
    segmentIndex,
    value: dateInputTextFromParts(parts)
  };
}

export function moveNoteComposerDateInputSegment(
  value: string,
  segmentIndex: NoteComposerDateSegmentIndex,
  direction: "left" | "right" | "current"
): NoteComposerDateInputEditState & { range: { start: number; end: number } } {
  const nextSegment = nextDateInputSegmentIndex(segmentIndex, direction);
  return {
    range: dateInputSegmentRange(value, nextSegment),
    segmentBuffer: "",
    segmentIndex: nextSegment,
    value
  };
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
  pickerOption?: NoteComposerTaskDateSuggestion;
  pickerSegmentBuffer?: string;
  pickerSegmentIndex?: NoteComposerDateSegmentIndex;
  pickerText?: string;
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
      if (this.active.selectedIndex === DATE_PICKER_SELECTION_INDEX && this.handleSelectedDatePickerKey(event)) return;
      if (event.key === "ArrowDown") {
        consumeSuggestKeyEvent(event);
        this.selectOffset(1);
        return;
      }
      if (event.key === "ArrowUp") {
        consumeSuggestKeyEvent(event);
        this.selectOffset(-1);
        return;
      }
      if (event.key === "Escape") {
        consumeSuggestKeyEvent(event);
        this.close();
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && this.active.options.length > 0) {
        const option = this.selectedSuggestItem();
        if (event.key === "Enter" && option?.kind === "enter") {
          this.close();
          return;
        }
        consumeSuggestKeyEvent(event);
        if (event.key === "Tab" && option?.kind === "enter") {
          this.selectOffset(1);
          return;
        }
        if (option) this.applySuggestion(option);
      }
    };
    private readonly focusHandler = () => {
      this.sync();
    };
    private readonly blurHandler = () => {
      this.scheduleRender();
    };

    constructor(private readonly view: EditorView) {
      this.view.dom.addEventListener("keydown", this.keydownHandler, { capture: true });
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
      this.view.dom.removeEventListener("keydown", this.keydownHandler, { capture: true });
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
      const options: NoteComposerSuggestItem[] = [
        ...(dateOptions.length > 0 ? [NOTE_COMPOSER_ENTER_SUGGESTION] : []),
        ...dateOptions,
        ...suggestNoteComposerBlocksAtCursor(text, cursor),
        ...tagOptions
      ];
      if (options.length === 0) {
        this.close();
        return;
      }
      const previousLabel = this.active ? this.active.options[this.active.selectedIndex]?.label : undefined;
      const previousDatePickerSelected = this.active?.selectedIndex === DATE_PICKER_SELECTION_INDEX;
      const selectedIndex = previousDatePickerSelected && hasTaskDateOption(options)
        ? DATE_PICKER_SELECTION_INDEX
        : previousLabel
          ? Math.max(0, options.findIndex((option) => option.label === previousLabel))
          : 0;
      const selectedOption = options[selectedIndex];
      const previousPickerOption = this.active?.pickerOption;
      const pickerOption = selectedOption?.kind === "task-date"
        ? selectedOption
        : previousPickerOption && options.some((option) => option.kind === "task-date" && option.dateKind === previousPickerOption.dateKind)
          ? previousPickerOption
          : options.find((option): option is NoteComposerTaskDateSuggestion => option.kind === "task-date");
      this.active = { cursor, options, pickerOption, selectedIndex };
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
        : this.active.pickerOption ?? this.active.options.find((option): option is NoteComposerTaskDateSuggestion => option.kind === "task-date");
      if (dateOption) {
        popup.appendChild(this.renderDatePicker(dateOption, this.active.selectedIndex === DATE_PICKER_SELECTION_INDEX));
      }
      for (const [index, option] of this.active.options.entries()) {
        const item = this.view.dom.ownerDocument.createElement("div");
        item.className = `task-hub-note-composer-suggest-item ${option.kind === "enter" ? "task-hub-note-composer-suggest-enter" : ""} ${index === this.active.selectedIndex ? "is-selected" : ""}`;
        item.createSpan({ cls: `task-hub-note-composer-suggest-label ${option.kind === "enter" ? "task-hub-note-composer-suggest-enter-icon" : ""}`, text: option.label });
        if (option.kind === "enter" || option.kind === "shortcut" || option.kind === "task-date") item.createSpan({ cls: "task-hub-note-composer-suggest-detail", text: option.detail });
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          if (option.kind === "enter") {
            this.close();
            this.view.focus();
          } else {
            this.applySuggestion(option);
          }
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
      if (this.active.selectedIndex === DATE_PICKER_SELECTION_INDEX) {
        const input = popup.querySelector<HTMLInputElement>(".task-hub-note-composer-date-picker-input");
        input?.focus({ preventScroll: true });
        if (input) this.selectDateInputSegment(input, "current");
      }
    }

    private renderDatePicker(option: NoteComposerTaskDateSuggestion, selected: boolean): HTMLElement {
      const wrapper = this.view.dom.ownerDocument.createElement("label");
      wrapper.className = `task-hub-note-composer-date-picker ${selected ? "is-selected" : ""}`;
      wrapper.createSpan({ cls: "task-hub-note-composer-date-picker-label", text: option.pickerLabel });
      const input = wrapper.createEl("input", {
        cls: "task-hub-note-composer-date-picker-input",
        type: "text",
        value: this.active?.pickerText ?? formatNoteComposerDateInput(option.dateKey)
      });
      input.inputMode = "numeric";
      input.placeholder = "YYYY/MM/DD";
      input.addEventListener("mousedown", (event) => event.stopPropagation());
      input.addEventListener("click", () => {
        this.activateDatePickerInput(option, wrapper);
        this.selectDateInputSegment(input, "current");
      });
      input.addEventListener("focus", () => {
        this.activateDatePickerInput(option, wrapper);
      });
      input.addEventListener("change", () => {
        this.storeDatePickerText(input.value);
        const dateKey = parseNoteComposerDateInput(input.value);
        if (!dateKey) return;
        this.applyTaskDate(option, dateKey);
      });
      input.addEventListener("input", () => {
        this.storeDatePickerText(input.value);
      });
      input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (/^\d$/u.test(event.key)) {
          consumeSuggestKeyEvent(event);
          this.editDateInputSegment(input, event.key);
          return;
        }
        if (event.key === "Enter") {
          consumeSuggestKeyEvent(event);
          const dateKey = parseNoteComposerDateInput(input.value);
          if (dateKey) this.applyTaskDate(option, dateKey);
          return;
        }
        if (event.key === "Escape") {
          consumeSuggestKeyEvent(event);
          this.close();
          this.view.focus();
          return;
        }
        if (event.key === "ArrowDown") {
          consumeSuggestKeyEvent(event);
          this.setSelectedIndex(0);
          this.view.focus();
          return;
        }
        if (event.key === "ArrowUp") {
          consumeSuggestKeyEvent(event);
          this.setSelectedIndex((this.active?.options.length ?? 1) - 1);
          this.view.focus();
          return;
        }
        if (event.key === "ArrowLeft") {
          consumeSuggestKeyEvent(event);
          this.selectDateInputSegment(input, "left");
          return;
        }
        if (event.key === "ArrowRight") {
          consumeSuggestKeyEvent(event);
          this.selectDateInputSegment(input, "right");
        }
      });
      return wrapper;
    }

    private handleSelectedDatePickerKey(event: KeyboardEvent): boolean {
      if (!this.active?.pickerOption) return false;
      if (/^\d$/u.test(event.key)) {
        consumeSuggestKeyEvent(event);
        this.editActiveDatePickerSegment(event.key);
        return true;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        consumeSuggestKeyEvent(event);
        this.selectActiveDatePickerSegment(event.key === "ArrowLeft" ? "left" : "right");
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        consumeSuggestKeyEvent(event);
        const dateKey = parseNoteComposerDateInput(this.active.pickerText ?? formatNoteComposerDateInput(this.active.pickerOption.dateKey));
        if (dateKey) this.applyTaskDate(this.active.pickerOption, dateKey);
        return true;
      }
      return false;
    }

    private activateDatePickerInput(option: NoteComposerTaskDateSuggestion, wrapper: HTMLElement): void {
      if (this.active) {
        this.active = {
          ...this.active,
          pickerOption: option,
          pickerText: this.active.pickerText ?? formatNoteComposerDateInput(option.dateKey),
          selectedIndex: DATE_PICKER_SELECTION_INDEX
        };
      }
      wrapper.classList.add("is-selected");
      this.popup?.querySelectorAll(".task-hub-note-composer-suggest-item.is-selected").forEach((element) => element.removeClass("is-selected"));
    }

    private editDateInputSegment(input: HTMLInputElement, digit: string): void {
      const currentSegment = this.active?.pickerSegmentIndex ?? dateInputSegmentIndexAtCursor(input.value, input.selectionStart ?? input.value.length);
      const currentBuffer = this.active?.pickerSegmentIndex === currentSegment ? this.active.pickerSegmentBuffer : undefined;
      const next = editNoteComposerDateInputSegment(input.value, currentSegment, currentBuffer, digit);
      input.value = next.value;
      this.storeDatePickerText(next.value, next.segmentIndex, next.segmentBuffer);
      this.selectDateInputSegment(input, "current");
    }

    private editActiveDatePickerSegment(digit: string): void {
      if (!this.active?.pickerOption) return;
      const value = this.active.pickerText ?? formatNoteComposerDateInput(this.active.pickerOption.dateKey);
      const currentSegment = this.active.pickerSegmentIndex ?? 2;
      const next = editNoteComposerDateInputSegment(value, currentSegment, this.active.pickerSegmentBuffer, digit);
      this.storeDatePickerText(next.value, next.segmentIndex, next.segmentBuffer);
      this.render();
    }

    private selectDateInputSegment(input: HTMLInputElement, direction: "left" | "right" | "current"): void {
      const currentSegment = this.active?.pickerSegmentIndex ?? dateInputSegmentIndexAtCursor(input.value, input.selectionStart ?? input.value.length);
      const next = moveNoteComposerDateInputSegment(input.value, currentSegment, direction);
      const segmentBuffer = direction === "current" ? this.active?.pickerSegmentBuffer ?? "" : next.segmentBuffer;
      this.storeDatePickerText(next.value, next.segmentIndex, segmentBuffer);
      input.setSelectionRange(next.range.start, next.range.end);
    }

    private selectActiveDatePickerSegment(direction: "left" | "right" | "current"): void {
      if (!this.active?.pickerOption) return;
      const value = this.active.pickerText ?? formatNoteComposerDateInput(this.active.pickerOption.dateKey);
      const currentSegment = this.active.pickerSegmentIndex ?? 2;
      const next = moveNoteComposerDateInputSegment(value, currentSegment, direction);
      this.storeDatePickerText(next.value, next.segmentIndex, next.segmentBuffer);
      this.render();
    }

    private storeDatePickerText(value: string, segmentIndex = this.active?.pickerSegmentIndex, segmentBuffer = this.active?.pickerSegmentBuffer): void {
      if (!this.active) return;
      this.active = {
        ...this.active,
        pickerSegmentBuffer: segmentBuffer,
        pickerSegmentIndex: segmentIndex,
        pickerText: value
      };
    }

    private selectOffset(offset: number): void {
      if (!this.active) return;
      const hasDatePicker = hasTaskDateOption(this.active.options);
      const minIndex = hasDatePicker ? DATE_PICKER_SELECTION_INDEX : 0;
      const selectableCount = this.active.options.length + (hasDatePicker ? 1 : 0);
      const normalizedIndex = this.active.selectedIndex - minIndex;
      const nextIndex = ((normalizedIndex + offset + selectableCount) % selectableCount) + minIndex;
      this.setSelectedIndex(nextIndex, this.pickerOptionForIndex(nextIndex));
    }

    private setSelectedIndex(selectedIndex: number, pickerOption = this.pickerOptionForIndex(selectedIndex)): void {
      if (!this.active) return;
      const pickerChanged = pickerOption && pickerOption !== this.active.pickerOption;
      this.active = {
        ...this.active,
        pickerOption,
        pickerSegmentBuffer: pickerChanged ? "" : this.active.pickerSegmentBuffer,
        pickerSegmentIndex: pickerChanged ? undefined : this.active.pickerSegmentIndex,
        pickerText: pickerChanged ? formatNoteComposerDateInput(pickerOption.dateKey) : this.active.pickerText,
        selectedIndex
      };
      this.render();
    }

    private selectedSuggestItem(): NoteComposerSuggestItem | undefined {
      if (!this.active) return undefined;
      if (this.active.selectedIndex === DATE_PICKER_SELECTION_INDEX) return this.active.pickerOption;
      return this.active.options[this.active.selectedIndex];
    }

    private pickerOptionForIndex(selectedIndex: number): NoteComposerTaskDateSuggestion | undefined {
      if (!this.active) return undefined;
      const option = this.active.options[selectedIndex];
      if (option?.kind === "task-date") return option;
      if (selectedIndex === DATE_PICKER_SELECTION_INDEX) {
        const previousOption = this.active.options[this.active.selectedIndex];
        if (previousOption?.kind === "task-date") return previousOption;
      }
      return this.active.pickerOption ?? this.active.options.find((candidate): candidate is NoteComposerTaskDateSuggestion => candidate.kind === "task-date");
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
      const insertPrefix = option.insert.match(/^\s*/u)?.[0] ?? "";
      const insert = `${insertPrefix}${taskDateSuggestionInsert(option.dateKind, dateKey)}`;
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

function consumeSuggestKeyEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function hasTaskDateOption(options: NoteComposerSuggestItem[]): boolean {
  return options.some((option) => option.kind === "task-date");
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
