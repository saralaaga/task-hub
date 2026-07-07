import type { DatedNote } from "../datedNotes";
import type { Translator } from "../i18n";

export type DatedNotesViewState = {
  selectedPath?: string;
  query: string;
  t: Translator;
  animateDetailTransition?: boolean;
};

export type DatedNotesViewHandlers = {
  onSelectNote: (note: DatedNote) => void;
  onOpenNoteSource: (path: string) => void | Promise<void>;
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
  note: DatedNote,
  state: DatedNotesViewState,
  handlers: DatedNotesViewHandlers,
  options: DatedNotesViewOptions
): void {
  const header = container.createDiv({ cls: "task-hub-dated-note-detail-header" });
  const meta = header.createDiv({ cls: "task-hub-dated-note-meta" });
  meta.createSpan({ text: note.date });
  if (note.createdAt) meta.createSpan({ text: timeLabel(note.createdAt) });
  meta.createSpan({ text: "taskhub-type: note" });
  if (note.tags.length > 0) {
    const tags = header.createDiv({ cls: "task-hub-tag-row" });
    for (const tag of note.tags) tags.createSpan({ cls: "task-hub-task-tag", text: tag });
  }

  const body = container.createDiv({ cls: "task-hub-dated-note-body" });
  if (note.body.trim()) {
    if (options.renderNoteMarkdown) {
      options.renderNoteMarkdown(body, note.body, note.path);
    } else {
      body.createEl("p", { text: note.body });
    }
  } else {
    body.createDiv({ cls: "task-hub-empty", text: state.t("noDatedNotes") });
  }

  const actions = container.createDiv({ cls: "task-hub-dated-note-actions" });
  const open = actions.createEl("button", { cls: "task-hub-create-task-button", text: state.t("openSource") });
  open.addEventListener("click", () => {
    void handlers.onOpenNoteSource(note.path);
  });
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
    header.createSpan({ cls: "task-hub-dated-note-day-count", text: `${group.notes.length} ${state.t("notes")}` });
    for (const note of group.notes) {
      const card = section.createEl("button", {
        cls: `task-hub-dated-note-card ${note.path === selected.path ? "is-active" : ""}`
      });
      card.createEl("p", { cls: "task-hub-dated-note-excerpt", text: noteExcerpt(note) });
      const footer = card.createSpan({ cls: "task-hub-dated-note-card-footer" });
      if (note.tags.length > 0) {
        const tags = footer.createSpan({ cls: "task-hub-dated-note-card-tags" });
        for (const tag of note.tags) tags.createSpan({ cls: "task-hub-task-tag", text: tag });
      }
      if (note.createdAt) footer.createSpan({ cls: "task-hub-dated-note-time", text: timeLabel(note.createdAt) });
      card.addEventListener("click", () => handlers.onSelectNote(note));
    }
  }
}

function groupNotesByDate(notes: DatedNote[]): Array<{ date: string; notes: DatedNote[] }> {
  const groups = new Map<string, DatedNote[]>();
  for (const note of notes) {
    groups.set(note.date, [...(groups.get(note.date) ?? []), note]);
  }
  return Array.from(groups.entries()).map(([date, groupNotes]) => ({ date, notes: groupNotes }));
}

function dayTitle(date: string, t: Translator): string {
  const today = toLocalDateKey(new Date());
  if (date === today) return `${t("today")} · ${date}`;
  return date;
}

function noteExcerpt(note: DatedNote): string {
  return note.body
    .replace(/^#+\s*/gmu, "")
    .replace(/\s+/gu, " ")
    .trim() || note.path;
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
