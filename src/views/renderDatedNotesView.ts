import type { TaskItem } from "../types";
import { HUB_NOTE_UNDATED_DATE, type TimelineHubNote } from "../hubNotes";
import type { Translator } from "../i18n";
import { taskPlannedDateKey, taskStartDateKey } from "../taskDates";

const DEFAULT_DATED_NOTE_DETAIL_RADIUS = 1;
const DEFAULT_DATED_NOTE_LIST_PAGE_SIZE = 12;
const DATED_NOTE_SCROLL_EDGE_THRESHOLD = 96;
const DATED_NOTE_SCROLL_END_THRESHOLD = 120;

export type DatedNoteDayStats = {
  startedCount: number;
  scheduledCount: number;
  completedCount: number;
};

export type DatedNoteGroup = {
  date: string;
  notes: TimelineHubNote[];
};

export type DatedNotesViewModel = {
  filteredNotes: TimelineHubNote[];
  selected: TimelineHubNote | undefined;
  detailGroups: DatedNoteGroup[];
  listGroups: DatedNoteGroup[];
  detailAnchorIndex: number;
  listSelectedIndex: number;
};

export type DatedNotesViewState = {
  selectedPath?: string;
  query: string;
  t: Translator;
  animateDetailTransition?: boolean;
  dayStatsByDate?: Readonly<Record<string, DatedNoteDayStats>>;
  detailStartIndex?: number;
  detailEndIndex?: number;
  listVisibleCount?: number;
};

export type DatedNotesViewHandlers = {
  onSelectNote: (note: TimelineHubNote) => void;
  onOpenNoteSource: (path: string) => void | Promise<void>;
  onOpenNoteActions: (note: TimelineHubNote, event: MouseEvent) => void;
  onReachDetailStart?: () => void;
  onReachDetailEnd?: () => void;
  onReachListEnd?: () => void;
};

export type DatedNotesViewOptions = {
  renderNoteMarkdown?: (container: HTMLElement, body: string, sourcePath: string) => void;
  getRelatedTasks?: (note: TimelineHubNote) => TaskItem[];
};

export function renderDatedNotesView(
  container: HTMLElement,
  notes: TimelineHubNote[],
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions = {}
): void {
  container.empty();
  const model = buildDatedNotesViewModel(notes, state.query, state.selectedPath);
  const { selected, detailGroups, listGroups, detailAnchorIndex, listSelectedIndex } = model;
  const root = container.createDiv({ cls: "task-hub-dated-notes-view" });

  if (!selected) {
    root.createDiv({ cls: "task-hub-empty", text: state.t("noDatedNotes") });
    return;
  }

  const detailRange = normalizeDetailRange(
    detailGroups.length,
    detailAnchorIndex,
    state.detailStartIndex,
    state.detailEndIndex
  );
  const listVisibleCount = normalizeListVisibleCount(listGroups.length, state.listVisibleCount, listSelectedIndex);
  const detail = root.createDiv({ cls: `task-hub-dated-note-detail ${state.animateDetailTransition ? "is-note-transition" : ""}` });
  const list = root.createDiv({ cls: "task-hub-dated-note-list" });

  renderDatedNoteDetail(
    detail,
    detailGroups.slice(detailRange.startIndex, detailRange.endIndex + 1),
    selected,
    state,
    handlers,
    options
  );
  bindDatedNoteDetailScroll(detail, detailRange.startIndex > 0, detailRange.endIndex < detailGroups.length - 1, handlers);

  renderDatedNoteList(list, listGroups.slice(0, listVisibleCount), selected, state, handlers, options);
  bindDatedNoteListScroll(list, listVisibleCount < listGroups.length, handlers);
}

export function buildDatedNotesViewModel(notes: TimelineHubNote[], query: string, selectedPath?: string): DatedNotesViewModel {
  const filteredNotes = filterDatedNotes(notes, query);
  const selected = selectedNote(filteredNotes, selectedPath);
  const detailGroups = groupNotesByDate(sortDatedNotesDescending(filteredNotes));
  const listGroups = groupNotesByDate(filteredNotes);
  const detailAnchorIndex = selected ? Math.max(0, detailGroups.findIndex((group) => group.date === selected.date)) : -1;
  const listSelectedIndex = selected ? Math.max(0, listGroups.findIndex((group) => group.date === selected.date)) : -1;
  return {
    filteredNotes,
    selected,
    detailGroups,
    listGroups,
    detailAnchorIndex,
    listSelectedIndex
  };
}

export function filterDatedNotes(notes: TimelineHubNote[], query: string): TimelineHubNote[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return notes;
  return notes.filter((note) => {
    const searchable = [note.title, note.body, note.date, note.path, ...note.tags].join("\n").toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

function selectedNote(notes: TimelineHubNote[], selectedPath: string | undefined): TimelineHubNote | undefined {
  return notes.find((note) => note.path === selectedPath) ?? notes[0];
}

function sortDatedNotesDescending(notes: TimelineHubNote[]): TimelineHubNote[] {
  return [...notes].sort((left, right) => {
    return (
      right.date.localeCompare(left.date) ||
      (right.createdAt ?? "").localeCompare(left.createdAt ?? "") ||
      right.path.localeCompare(left.path)
    );
  });
}

function normalizeDetailRange(count: number, anchorIndex: number, startIndex?: number, endIndex?: number): { startIndex: number; endIndex: number } {
  if (count <= 0) {
    return { startIndex: 0, endIndex: -1 };
  }
  const fallbackStart = Math.max(0, anchorIndex - DEFAULT_DATED_NOTE_DETAIL_RADIUS);
  const fallbackEnd = Math.min(count - 1, anchorIndex + DEFAULT_DATED_NOTE_DETAIL_RADIUS);
  const nextStart = clampIndex(startIndex ?? fallbackStart, count);
  const nextEnd = clampIndex(endIndex ?? fallbackEnd, count);
  if (nextStart > nextEnd || anchorIndex < nextStart || anchorIndex > nextEnd) {
    return { startIndex: fallbackStart, endIndex: fallbackEnd };
  }
  return { startIndex: nextStart, endIndex: nextEnd };
}

function normalizeListVisibleCount(count: number, visibleCount: number | undefined, selectedIndex: number): number {
  if (count <= 0) return 0;
  const minimum = Math.max(DEFAULT_DATED_NOTE_LIST_PAGE_SIZE, selectedIndex + 1);
  return Math.min(count, Math.max(minimum, visibleCount ?? minimum));
}

function clampIndex(index: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index));
}

function renderDatedNoteDetail(
  container: HTMLElement,
  groups: DatedNoteGroup[],
  selected: TimelineHubNote,
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions
): void {
  for (const group of groups) {
    const section = container.createDiv({
      cls: `task-hub-dated-note-detail-day ${group.date === selected.date ? "is-active" : ""}`
    });
    setElementAttr(section, "data-task-hub-note-date", group.date);
    renderDatedNoteDayHeader(section.createDiv({ cls: "task-hub-dated-note-detail-day-header" }), group, state);
    for (const note of group.notes) {
      const card = section.createDiv({ cls: `task-hub-dated-note-detail-card ${note.path === selected.path ? "is-active" : ""}` });
      const main = card.createDiv({ cls: "task-hub-dated-note-detail-main" });
      const body = main.createDiv({ cls: "task-hub-dated-note-body" });
      const side = main.createDiv({ cls: "task-hub-dated-note-detail-side" });
      const menu = side.createEl("button", { cls: "task-hub-dated-note-menu-button", text: "⋯" });
      renderRelatedTaskPreview(body, note, state.t, options.getRelatedTasks?.(note) ?? [], "detail");
      if (note.body.trim()) {
        if (options.renderNoteMarkdown) {
          options.renderNoteMarkdown(body, note.body, note.path);
        } else {
          body.createEl("p", { text: note.body });
        }
      } else {
        body.createDiv({ cls: "task-hub-empty", text: state.t("noDatedNotes") });
      }

      if (note.createdAt) side.createSpan({ cls: "task-hub-dated-note-time", text: timeLabel(note.createdAt) });
      menu.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handlers.onOpenNoteActions(note, event);
      });
    }
  }
}

function renderDatedNoteList(
  container: HTMLElement,
  groups: DatedNoteGroup[],
  selected: TimelineHubNote,
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions
): void {
  for (const group of groups) {
    const section = container.createDiv({ cls: "task-hub-dated-note-day" });
    renderDatedNoteDayHeader(section.createDiv({ cls: "task-hub-dated-note-day-header" }), group, state);
    for (const note of group.notes) {
      const card = section.createEl("button", {
        cls: `task-hub-dated-note-card ${note.path === selected.path ? "is-active" : ""}`
      });
      renderRelatedTaskPreview(card, note, state.t, options.getRelatedTasks?.(note) ?? [], "list");
      renderDatedNoteCardPreview(card, note);
      const footer = card.createSpan({ cls: "task-hub-dated-note-card-footer" });
      if (note.createdAt) footer.createSpan({ cls: "task-hub-dated-note-time", text: timeLabel(note.createdAt) });
      card.addEventListener("click", () => handlers.onSelectNote(note));
    }
  }
}

function renderDatedNoteDayHeader(container: HTMLElement, group: DatedNoteGroup, state: DatedNotesViewState): void {
  container.createSpan({ cls: "task-hub-dated-note-day-title", text: dayTitle(group.date, state.t) });
  const meta = container.createSpan({ cls: "task-hub-dated-note-day-meta" });
  if (state.dayStatsByDate) renderDatedNoteDayStats(meta, state.dayStatsByDate[group.date]);
  meta.createSpan({ cls: "task-hub-dated-note-day-count", text: `${group.notes.length} ${state.t("notes")}` });
}

function bindDatedNoteDetailScroll(
  container: HTMLElement,
  canLoadBefore: boolean,
  canLoadAfter: boolean,
  handlers: DatedNotesViewHandlers
): void {
  if ((!canLoadBefore || !handlers.onReachDetailStart) && (!canLoadAfter || !handlers.onReachDetailEnd)) return;
  container.addEventListener("scroll", () => {
    if (canLoadBefore && handlers.onReachDetailStart && container.scrollTop <= DATED_NOTE_SCROLL_EDGE_THRESHOLD) {
      handlers.onReachDetailStart();
    }
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (canLoadAfter && handlers.onReachDetailEnd && remaining <= DATED_NOTE_SCROLL_END_THRESHOLD) {
      handlers.onReachDetailEnd();
    }
  });
}

function bindDatedNoteListScroll(container: HTMLElement, canLoadAfter: boolean, handlers: DatedNotesViewHandlers): void {
  if (!canLoadAfter || !handlers.onReachListEnd) return;
  const onReachListEnd = handlers.onReachListEnd;
  container.addEventListener("scroll", () => {
    const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remaining <= DATED_NOTE_SCROLL_END_THRESHOLD) {
      onReachListEnd();
    }
  });
}

function renderRelatedTaskPreview(
  container: HTMLElement,
  note: TimelineHubNote,
  t: Translator,
  tasks: TaskItem[],
  mode: "detail" | "list"
): void {
  if (tasks.length === 0) return;
  const primaryTask = tasks[0];
  const preview = container.createDiv({
    cls:
      mode === "detail"
        ? "task-hub-dated-note-related-task task-hub-dated-note-related-task--detail"
        : "task-hub-dated-note-related-task task-hub-dated-note-related-task--list"
  });
  preview.createSpan({
    cls: primaryTask.completed
      ? "task-hub-dated-note-related-task-status is-completed"
      : "task-hub-dated-note-related-task-status",
    text: primaryTask.completed ? "[x]" : "[ ]"
  });
  preview.createSpan({ cls: "task-hub-dated-note-related-task-text", text: primaryTask.text });
  const metaParts = [relatedTaskSourceLabel(primaryTask, t), relatedTaskDateLabel(primaryTask)].filter(Boolean);
  if (tasks.length > 1) metaParts.push(`+${tasks.length - 1}`);
  if (metaParts.length > 0) {
    preview.createSpan({ cls: "task-hub-dated-note-related-task-meta", text: metaParts.join(" · ") });
  }
  if (mode === "detail" && note.body.trim()) {
    preview.addClass?.("has-body-gap");
  }
}

type DatedNotePreviewLine =
  | { type: "text"; text: string }
  | { type: "task"; text: string; checked: boolean; indent: number };

const DATED_NOTE_TASK_LINE = /^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/u;
const DATED_NOTE_PREVIEW_LINE_LIMIT = 3;

function renderDatedNoteCardPreview(card: HTMLElement, note: TimelineHubNote): void {
  const lines = notePreviewLines(note);
  const preview = card.createDiv({ cls: lines.some((line) => line.type === "task") ? "task-hub-dated-note-excerpt has-task-lines" : "task-hub-dated-note-excerpt" });
  for (const line of lines) {
    if (line.type === "text") {
      preview.createSpan({ cls: "task-hub-dated-note-preview-text", text: line.text });
      continue;
    }
    const task = preview.createSpan({ cls: "task-hub-dated-note-preview-task" });
    task.style.setProperty("--task-hub-dated-note-preview-indent", String(line.indent));
    task.createSpan({ cls: line.checked ? "task-hub-dated-note-preview-checkbox is-checked" : "task-hub-dated-note-preview-checkbox" });
    task.createSpan({ cls: "task-hub-dated-note-preview-task-text", text: line.text });
  }
}

function notePreviewLines(note: TimelineHubNote): DatedNotePreviewLine[] {
  const lines: DatedNotePreviewLine[] = [];
  for (const rawLine of note.body.split(/\r?\n/u)) {
    if (lines.length >= DATED_NOTE_PREVIEW_LINE_LIMIT) break;
    const taskLine = rawLine.match(DATED_NOTE_TASK_LINE);
    if (taskLine) {
      const text = taskLine[3].trim();
      if (!text) continue;
      lines.push({
        type: "task",
        checked: taskLine[2].toLowerCase() === "x",
        indent: Math.min(3, Math.floor(taskLine[1].replace(/\t/gu, "  ").length / 2)),
        text
      });
      continue;
    }

    const text = normalizePreviewText(rawLine);
    if (text) lines.push({ type: "text", text });
  }
  return lines.length > 0 ? lines : [{ type: "text", text: note.path }];
}

function normalizePreviewText(line: string): string {
  return line
    .replace(/^#+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function groupNotesByDate(notes: TimelineHubNote[]): DatedNoteGroup[] {
  const groups = new Map<string, TimelineHubNote[]>();
  for (const note of notes) {
    groups.set(note.date, [...(groups.get(note.date) ?? []), note]);
  }
  return Array.from(groups.entries()).map(([date, groupNotes]) => ({ date, notes: groupNotes }));
}

function renderDatedNoteDayStats(container: HTMLElement, stats: DatedNoteDayStats | undefined): void {
  const values = stats ?? { startedCount: 0, scheduledCount: 0, completedCount: 0 };
  const list = container.createSpan({ cls: "task-hub-dated-note-day-stats" });
  list.createSpan({ cls: "task-hub-dated-note-day-stat is-started", text: `🛫 ${values.startedCount}` });
  list.createSpan({ cls: "task-hub-dated-note-day-stat is-scheduled", text: `⏳ ${values.scheduledCount}` });
  list.createSpan({ cls: "task-hub-dated-note-day-stat is-completed", text: `✅ ${values.completedCount}` });
}

function dayTitle(date: string, t: Translator): string {
  if (date === HUB_NOTE_UNDATED_DATE) return t("noDate");
  const today = toLocalDateKey(new Date());
  if (date === today) return `${t("today")} · ${date}`;
  return date;
}

function noteExcerpt(note: TimelineHubNote): string {
  return notePreviewLines(note).map((line) => line.text).join(" ") || note.path;
}

function relatedTaskSourceLabel(task: TaskItem, t: Translator): string {
  if (task.source === "vault") return t("vaultTasks");
  if (task.source === "apple-reminders") return t("localAppleReminders");
  return t("dida");
}

function relatedTaskDateLabel(task: TaskItem): string {
  return taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? task.dueDate ?? "";
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setElementAttr(element: HTMLElement, name: string, value: string): void {
  if (typeof element.setAttribute === "function") {
    element.setAttribute(name, value);
    return;
  }
  const target = element as HTMLElement & { attrs?: Map<string, string> };
  target.attrs = target.attrs ?? new Map<string, string>();
  target.attrs.set(name, value);
}
