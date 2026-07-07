import { renderDatedNotesView } from "./renderDatedNotesView";
import type { DatedNote } from "../datedNotes";

class FakeElement {
  children: FakeElement[] = [];
  classes = new Set<string>();
  listeners = new Map<string, Array<() => void>>();
  text = "";
  type = "";

  empty(): void {
    this.children = [];
  }

  createDiv(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  createEl(tag: string, options: { cls?: string; text?: string } = {}): FakeElement {
    const child = this.append(options);
    child.type = tag;
    return child;
  }

  createSpan(options: { cls?: string; text?: string } = {}): FakeElement {
    return this.append(options);
  }

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
    }
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement();
    child.text = options.text ?? "";
    for (const cls of (options.cls ?? "").split(" ").filter(Boolean)) {
      child.classes.add(cls);
    }
    this.children.push(child);
    return child;
  }
}

function collect(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collect)];
}

function childWithClass(element: FakeElement, cls: string): FakeElement {
  const match = collect(element).find((child) => child.classes.has(cls));
  if (!match) throw new Error(`Missing ${cls}`);
  return match;
}

describe("renderDatedNotesView", () => {
  it("keeps the note detail header focused on metadata and tags", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: ["#work", "#daily"],
      createdAt: "2026-07-07T09:30:00"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      { onSelectNote: jest.fn(), onOpenNoteSource: jest.fn() }
    );

    const detailHeader = childWithClass(container, "task-hub-dated-note-detail-header");
    const detailHeaderChildren = collect(detailHeader);

    expect(detailHeaderChildren.some((child) => child.type === "h3")).toBe(false);
    expect(detailHeaderChildren.some((child) => child.classes.has("task-hub-dated-note-path"))).toBe(false);
    expect(detailHeaderChildren.map((child) => child.text)).not.toContain(note.title);
    expect(detailHeaderChildren.map((child) => child.text)).not.toContain(note.path);
    expect(detailHeaderChildren.filter((child) => child.classes.has("task-hub-task-tag")).map((child) => child.text)).toEqual([
      "#work",
      "#daily"
    ]);
  });

  it("renders note list cards as body previews with the time in the footer", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Title generated from body",
      body: "Body preview content #work",
      bodyStartLine: 7,
      tags: ["#work"],
      createdAt: "2026-07-07T09:30:00"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      { onSelectNote: jest.fn(), onOpenNoteSource: jest.fn() }
    );

    const card = childWithClass(container, "task-hub-dated-note-card");
    const cardChildren = collect(card);

    expect(cardChildren.some((child) => child.classes.has("task-hub-dated-note-title"))).toBe(false);
    expect(cardChildren.map((child) => child.text)).not.toContain(note.title);
    expect(childWithClass(card, "task-hub-dated-note-excerpt").text).toBe("Body preview content #work");
    expect(childWithClass(card, "task-hub-dated-note-card-footer").classes.has("task-hub-dated-note-card-footer")).toBe(true);
    expect(childWithClass(card, "task-hub-dated-note-time").text).toBe("09:30");
  });

  it("marks the detail pane for a lightweight transition when requested", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T09:30:00.000Z"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key, animateDetailTransition: true },
      { onSelectNote: jest.fn(), onOpenNoteSource: jest.fn() }
    );

    expect(childWithClass(container, "task-hub-dated-note-detail").classes.has("is-note-transition")).toBe(true);
  });
});
