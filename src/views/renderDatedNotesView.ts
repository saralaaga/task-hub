import type { DatedNote } from "../datedNotes";
import type { Translator } from "../i18n";

export type DatedNoteDayStats = {
  startedCount: number;
  scheduledCount: number;
  completedCount: number;
};

export type DatedNotesViewState = {
  selectedPath?: string;
  query: string;
  t: Translator;
  animateDetailTransition?: boolean;
  dayStatsByDate?: Readonly<Record<string, DatedNoteDayStats>>;
};

export type DatedNotesViewHandlers = {
  onSelectNote: (note: DatedNote) => void;
  onOpenNoteSource: (path: string) => void | Promise<void>;
  onOpenNoteActions: (note: DatedNote, event: MouseEvent) => void;
};

export type DatedNotesViewOptions = {
  renderNoteMarkdown?: (container: HTMLElement, body: string, sourcePath: string) => void;
};

export function renderDatedNotesView(
  container: HTMLElement,
  notes: DatedNote[],
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions = {}
): void {
  container.empty();
  const filteredNotes = filterDatedNotes(notes, state.query);
  const selected = selectedNote(filteredNotes, state.selectedPath);
  const root = container.createDiv({ cls: "task-hub-dated-notes-view" });

  if (!selected) {
    root.createDiv({ cls: "task-hub-empty", text: state.t("noDatedNotes") });
    return;
  }

  renderDatedNoteDetail(
    root.createDiv({ cls: `task-hub-dated-note-detail ${state.animateDetailTransition ? "is-note-transition" : ""}` }),
    notes.filter((note) => note.date === selected.date),
    selected,
    state,
    handlers,
    options
  );
  renderDatedNoteList(root.createDiv({ cls: "task-hub-dated-note-list" }), filteredNotes, selected, state, handlers);
}

function filterDatedNotes(notes: DatedNote[], query: string): DatedNote[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return notes;
  return notes.filter((note) => {
    const searchable = [note.title, note.body, note.date, note.path, ...note.tags].join("\n").toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

function selectedNote(notes: DatedNote[], selectedPath: string | undefined): DatedNote | undefined {
  return notes.find((note) => note.path === selectedPath) ?? notes[0];
}

function renderDatedNoteDetail(
  container: HTMLElement,
  notes: DatedNote[],
  selected: DatedNote,
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions
): void {
  for (const note of notes) {
    const card = container.createDiv({ cls: `task-hub-dated-note-detail-card ${note.path === selected.path ? "is-active" : ""}` });
    const main = card.createDiv({ cls: "task-hub-dated-note-detail-main" });
    const body = main.createDiv({ cls: "task-hub-dated-note-body" });
    const side = main.createDiv({ cls: "task-hub-dated-note-detail-side" });
    const menu = side.createEl("button", { cls: "task-hub-dated-note-menu-button", text: "⋯" });
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

function renderDatedNoteList(
  container: HTMLElement,
  notes: DatedNote[],
  selected: DatedNote,
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers
): void {
  for (const group of groupNotesByDate(notes)) {
    const section = container.createDiv({ cls: "task-hub-dated-note-day" });
    const header = section.createDiv({ cls: "task-hub-dated-note-day-header" });
    header.createSpan({ cls: "task-hub-dated-note-day-title", text: dayTitle(group.date, state.t) });
    if (state.dayStatsByDate) renderDatedNoteDayStats(header, state.dayStatsByDate[group.date]);
    header.createSpan({ cls: "task-hub-dated-note-day-count", text: `${group.notes.length} ${state.t("notes")}` });
    for (const note of group.notes) {
      const card = section.createEl("button", {
        cls: `task-hub-dated-note-card ${note.path === selected.path ? "is-active" : ""}`
      });
      renderDatedNoteCardPreview(card, note);
      const footer = card.createSpan({ cls: "task-hub-dated-note-card-footer" });
      if (note.createdAt) footer.createSpan({ cls: "task-hub-dated-note-time", text: timeLabel(note.createdAt) });
      card.addEventListener("click", () => handlers.onSelectNote(note));
    }
  }
}

type DatedNotePreviewLine =
  | { type: "text"; text: string }
  | { type: "task"; text: string; checked: boolean; indent: number };

const DATED_NOTE_TASK_LINE = /^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/u;
const DATED_NOTE_PREVIEW_LINE_LIMIT = 4;

function renderDatedNoteCardPreview(card: HTMLElement, note: DatedNote): void {
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

function notePreviewLines(note: DatedNote): DatedNotePreviewLine[] {
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

function groupNotesByDate(notes: DatedNote[]): Array<{ date: string; notes: DatedNote[] }> {
  const groups = new Map<string, DatedNote[]>();
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
  const today = toLocalDateKey(new Date());
  if (date === today) return `${t("today")} · ${date}`;
  return date;
}

function noteExcerpt(note: DatedNote): string {
  return notePreviewLines(note).map((line) => line.text).join(" ") || note.path;
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
