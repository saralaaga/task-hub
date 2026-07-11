import { renderDatedNotesView } from "./renderDatedNotesView";
import type { DatedNote } from "../datedNotes";

class FakeElement {
  children: FakeElement[] = [];
  classes = new Set<string>();
  listeners = new Map<string, Array<(event?: any) => void>>();
  style = {
    values: new Map<string, string>(),
    setProperty: jest.fn((name: string, value: string) => {
      this.style.values.set(name, value);
    })
  };
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

  addEventListener(name: string, listener: (event?: any) => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  click(): { preventDefault: jest.Mock; stopPropagation: jest.Mock } {
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    for (const listener of this.listeners.get("click") ?? []) {
      listener(event);
    }
    return event;
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

function datedNoteHandlers(overrides: Partial<Parameters<typeof renderDatedNotesView>[3]> = {}): Parameters<typeof renderDatedNotesView>[3] {
  return {
    onSelectNote: jest.fn(),
    onOpenNoteSource: jest.fn(),
    onOpenNoteActions: jest.fn(),
    ...overrides
  };
}

describe("renderDatedNotesView", () => {
  it("renders detail cards with the note body first and footer metadata", () => {
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
      datedNoteHandlers()
    );

    const detailCard = childWithClass(container, "task-hub-dated-note-detail-card");
    const detailCardChildren = collect(detailCard);

    expect(detailCard.children[0]?.classes.has("task-hub-dated-note-detail-main")).toBe(true);
    expect(detailCardChildren.some((child) => child.classes.has("task-hub-dated-note-detail-footer"))).toBe(false);
    expect(detailCardChildren.some((child) => child.classes.has("task-hub-task-tag"))).toBe(false);
    expect(detailCardChildren.some((child) => child.type === "h3")).toBe(false);
    expect(detailCardChildren.some((child) => child.classes.has("task-hub-dated-note-path"))).toBe(false);
    expect(detailCardChildren.map((child) => child.text)).not.toContain(note.title);
    expect(detailCardChildren.map((child) => child.text)).not.toContain(note.path);
    expect(detailCardChildren.map((child) => child.text)).not.toContain("taskhub-type: note");
    expect(childWithClass(detailCard, "task-hub-dated-note-time").text).toBe("09:30");
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
      datedNoteHandlers()
    );

    const card = childWithClass(container, "task-hub-dated-note-card");
    const cardChildren = collect(card);

    expect(cardChildren.some((child) => child.classes.has("task-hub-dated-note-title"))).toBe(false);
    expect(cardChildren.map((child) => child.text)).not.toContain(note.title);
    expect(childWithClass(card, "task-hub-dated-note-preview-text").text).toBe("Body preview content #work");
    expect(childWithClass(card, "task-hub-dated-note-card-footer").classes.has("task-hub-dated-note-card-footer")).toBe(true);
    expect(cardChildren.some((child) => child.classes.has("task-hub-task-tag"))).toBe(false);
    expect(childWithClass(card, "task-hub-dated-note-time").text).toBe("09:30");
  });

  it("renders started, planned, and completed day stats in the day header", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T09:30:00"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      {
        query: "",
        selectedPath: note.path,
        t: (key) => key,
        dayStatsByDate: {
          "2026-07-07": {
            startedCount: 1,
            scheduledCount: 3,
            completedCount: 2
          }
        }
      },
      datedNoteHandlers()
    );

    const header = childWithClass(container, "task-hub-dated-note-day-header");
    const headerChildren = collect(header);

    expect(childWithClass(header, "task-hub-dated-note-day-stats").classes.has("task-hub-dated-note-day-stats")).toBe(true);
    expect(headerChildren.map((child) => child.text)).toEqual(expect.arrayContaining(["🛫 1", "⏳ 3", "✅ 2"]));
  });

  it("renders task list note cards as structured checkbox previews", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试输入任务",
      body: "测试输入任务\n- [ ] 测试\n  - [ ] 测试换行\n  - [x] 测试子任务\n  - [ ]",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers()
    );

    const card = childWithClass(container, "task-hub-dated-note-card");
    const excerpt = childWithClass(card, "task-hub-dated-note-excerpt");
    const cardChildren = collect(card);
    const taskRows = cardChildren.filter((child) => child.classes.has("task-hub-dated-note-preview-task"));

    expect(excerpt.classes.has("has-task-lines")).toBe(true);
    expect(childWithClass(card, "task-hub-dated-note-preview-text").text).toBe("测试输入任务");
    expect(taskRows).toHaveLength(3);
    expect(cardChildren.filter((child) => child.classes.has("task-hub-dated-note-preview-task-text")).map((child) => child.text)).toEqual([
      "测试",
      "测试换行",
      "测试子任务"
    ]);
    expect(cardChildren.some((child) => child.text.includes("- [ ]"))).toBe(false);
    expect(taskRows[1].style.values.get("--task-hub-dated-note-preview-indent")).toBe("1");
  });

  it("shows all notes from the selected day in the detail pane", () => {
    const container = new FakeElement();
    const selected: DatedNote = {
      path: "Notes/selected.md",
      date: "2026-07-09",
      title: "Selected",
      body: "Selected body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    };
    const sameDay: DatedNote = {
      path: "Notes/same-day.md",
      date: "2026-07-09",
      title: "Same day",
      body: "Same day body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T21:54:00"
    };
    const otherDay: DatedNote = {
      path: "Notes/other-day.md",
      date: "2026-07-07",
      title: "Other day",
      body: "Other day body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T21:54:00"
    };

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [selected, sameDay, otherDay],
      { query: "", selectedPath: selected.path, t: (key) => key },
      datedNoteHandlers()
    );

    const detail = childWithClass(container, "task-hub-dated-note-detail");
    const detailChildren = collect(detail);
    const detailCards = detailChildren.filter((child) => child.classes.has("task-hub-dated-note-detail-card"));
    expect(detailCards).toHaveLength(2);
    expect(detailChildren.map((child) => child.text)).toEqual(expect.arrayContaining(["Selected body", "Same day body"]));
    expect(detailChildren.map((child) => child.text)).not.toContain("Other day body");
  });

  it("opens note actions from the detail card menu button", () => {
    const container = new FakeElement();
    const note: DatedNote = {
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试输入任务",
      body: "测试输入任务",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    };
    const onOpenNoteActions = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers({ onOpenNoteActions })
    );

    const menuButton = childWithClass(container, "task-hub-dated-note-menu-button");
    const event = menuButton.click();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onOpenNoteActions).toHaveBeenCalledWith(note, event);
    expect(collect(container).some((child) => child.text === "openSource")).toBe(false);
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
      datedNoteHandlers()
    );

    expect(childWithClass(container, "task-hub-dated-note-detail").classes.has("is-note-transition")).toBe(true);
  });
});
