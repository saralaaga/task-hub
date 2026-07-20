import { buildDatedNotesViewModel, renderDatedNotesView } from "./renderDatedNotesView";
import type { TimelineHubNote } from "../hubNotes";
import type { TaskItem } from "../types";

jest.mock("obsidian", () => ({
  setIcon: jest.fn((element: { setAttribute?: (name: string, value: string) => void }, icon: string) => {
    element.setAttribute?.("data-icon", icon);
  }),
  setTooltip: jest.fn((element: { setAttribute?: (name: string, value: string) => void }, value: string) => {
    element.setAttribute?.("data-tooltip", value);
  })
}), { virtual: true });

class FakeElement {
  children: FakeElement[] = [];
  classes = new Set<string>();
  listeners = new Map<string, Array<(event?: any) => void>>();
  attrs = new Map<string, string>();
  parentElement: FakeElement | null = null;
  scrollTop = 0;
  scrollHeight = 0;
  clientHeight = 0;
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

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  get classList(): { contains: (name: string) => boolean } {
    return {
      contains: (name: string) => this.classes.has(name)
    };
  }

  click(): { preventDefault: jest.Mock; stopPropagation: jest.Mock } {
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
    for (const listener of this.listeners.get("click") ?? []) {
      listener(event);
    }
    return event;
  }

  dispatch(name: string, event: any = {}): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
  }

  private append(options: { cls?: string; text?: string } = {}): FakeElement {
    const child = new FakeElement();
    child.text = options.text ?? "";
    child.parentElement = this;
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

function makeTimelineNote(
  note: Omit<TimelineHubNote, "kind" | "related" | "history" | "sourceKind" | "dateDerived"> &
    Partial<Pick<TimelineHubNote, "kind" | "related" | "history" | "sourceKind" | "dateDerived">>
): TimelineHubNote {
  return {
    kind: "manual",
    related: [],
    history: [],
    sourceKind: "dated-note",
    dateDerived: false,
    ...note
  };
}

function relatedTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: overrides.id ?? "task-1",
    filePath: overrides.filePath ?? "Inbox.md",
    line: overrides.line ?? 3,
    rawLine: overrides.rawLine ?? "- [ ] Linked task",
    text: overrides.text ?? "Linked task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    source: overrides.source ?? "vault",
    stableId: overrides.stableId,
    parentId: overrides.parentId,
    indent: overrides.indent,
    dueDate: overrides.dueDate,
    scheduledDate: overrides.scheduledDate,
    startDate: overrides.startDate,
    completedDate: overrides.completedDate,
    externalId: overrides.externalId,
    externalListId: overrides.externalListId
  };
}

describe("renderDatedNotesView", () => {
  it("keeps both detail groups and the list newest first", () => {
    const older = makeTimelineNote({
      path: "Notes/2026-07-07 0930 - Older.md",
      date: "2026-07-07",
      title: "Older",
      body: "Older body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T09:30:00"
    });
    const newer = makeTimelineNote({
      path: "Notes/2026-07-09 1015 - Newer.md",
      date: "2026-07-09",
      title: "Newer",
      body: "Newer body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T10:15:00"
    });

    const model = buildDatedNotesViewModel([newer, older], "", undefined);

    expect(model.selected?.path).toBe(newer.path);
    expect(model.detailGroups.map((group) => group.date)).toEqual(["2026-07-09", "2026-07-07"]);
    expect(model.listGroups.map((group) => group.date)).toEqual(["2026-07-09", "2026-07-07"]);
  });

  it("renders detail cards with the note body first and footer metadata", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: ["#work", "#daily"],
      createdAt: "2026-07-07T09:30:00"
    });

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
    const note = makeTimelineNote({
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Title generated from body",
      body: "Body preview content #work",
      bodyStartLine: 7,
      tags: ["#work"],
      createdAt: "2026-07-07T09:30:00"
    });

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
    const note = makeTimelineNote({
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T09:30:00"
    });

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
    const meta = childWithClass(header, "task-hub-dated-note-day-meta");
    const headerChildren = collect(header);

    expect(childWithClass(meta, "task-hub-dated-note-day-stats").classes.has("task-hub-dated-note-day-stats")).toBe(true);
    expect(childWithClass(meta, "task-hub-dated-note-day-count").attrs.get("aria-label")).toBe("notes: 1");
    expect(childWithClass(meta, "task-hub-dated-note-day-count").attrs.get("title")).toBe("notes: 1");
    expect(childWithClass(meta, "task-hub-dated-note-day-count").attrs.get("data-tooltip")).toBe("notes: 1");
    expect(collect(meta).filter((child) => child.classes.has("task-hub-dated-note-day-stat-icon")).map((child) => child.attrs.get("data-icon"))).toEqual([
      "send",
      "clock-3",
      "check-check",
      "sticky-note"
    ]);
    expect(collect(meta).filter((child) => child.classes.has("task-hub-dated-note-day-stat")).map((child) => child.attrs.get("data-tooltip"))).toEqual([
      "started: 1",
      "scheduled: 3",
      "completed: 2",
      "notes: 1"
    ]);
    expect(headerChildren.filter((child) => child.classes.has("task-hub-dated-note-day-stat-value")).map((child) => child.text)).toEqual(["1", "3", "2", "1"]);
  });

  it("renders task list note cards as structured checkbox previews", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试输入任务",
      body: "测试输入任务\n- [ ] 测试\n  - [ ] 测试换行\n  - [x] 测试子任务\n  - [ ]",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });

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
    expect(taskRows).toHaveLength(2);
    expect(cardChildren.filter((child) => child.classes.has("task-hub-dated-note-preview-task-text")).map((child) => child.text)).toEqual([
      "测试",
      "测试换行"
    ]);
    expect(cardChildren.some((child) => child.text.includes("- [ ]"))).toBe(false);
    expect(taskRows[1].style.values.get("--task-hub-dated-note-preview-indent")).toBe("1");
  });

  it("renders Tasks plugin custom status lines as unchecked task previews", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试 Tasks 插件状态",
      body: "- [/] 进行中\n- [?] 等待确认\n- [-] 取消",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers()
    );

    const taskRows = collect(container).filter((child) => child.classes.has("task-hub-dated-note-preview-task"));
    const checkboxes = collect(container).filter((child) => child.classes.has("task-hub-dated-note-preview-checkbox"));

    expect(taskRows).toHaveLength(3);
    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-preview-task-text")).map((child) => child.text)).toEqual([
      "进行中",
      "等待确认",
      "取消"
    ]);
    expect(checkboxes.map((checkbox) => (checkbox as unknown as { checked?: boolean }).checked)).toEqual([false, false, false]);
  });

  it("toggles a markdown-rendered Tasks plugin custom status checkbox from the detail pane", () => {
    const container = new FakeElement();
    const onNoteCheckboxToggle = jest.fn();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试 Tasks 插件状态",
      body: "- [/] 进行中",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        onNoteCheckboxToggle,
        renderNoteMarkdown: (markdown) => {
          const checkbox = markdown.createEl("input", { cls: "task-list-item-checkbox" });
          (checkbox as unknown as { checked: boolean }).checked = false;
        }
      }
    );

    const markdown = childWithClass(container, "task-hub-dated-note-markdown");
    const checkbox = childWithClass(markdown, "task-list-item-checkbox");
    markdown.dispatch("click", { target: checkbox, preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(onNoteCheckboxToggle).toHaveBeenCalledWith(note, 7, "- [/] 进行中", true);
  });

  it("renders related task previews only in the detail note pane", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Linked.md",
      date: "2026-07-09",
      title: "Linked note",
      body: "Body preview",
      bodyStartLine: 7,
      tags: [],
      related: ["task:vault:Inbox.md:3:hash"],
      sourceKind: "hybrid",
      createdAt: "2026-07-09T22:13:00"
    });
    const task = relatedTask({ text: "Prepare meeting deck" });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      { getRelatedTasks: () => [task] }
    );

    const relatedPreviews = collect(container).filter((child) => child.classes.has("task-hub-dated-note-related-task"));
    expect(relatedPreviews).toHaveLength(1);
    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-related-task-text")).map((child) => child.text)).toEqual([
      "Prepare meeting deck"
    ]);
    expect(collect(container).some((child) => child.classes.has("task-hub-dated-note-related-task-status") && child.classes.has("task-hub-dated-note-preview-checkbox"))).toBe(true);
    expect(collect(container).some((child) => child.classes.has("task-hub-dated-note-related-task-meta"))).toBe(false);
    expect(childWithClass(container, "task-hub-dated-note-card").children.some((child) => child.classes.has("task-hub-dated-note-related-task"))).toBe(false);
  });

  it("completes a related task from the detail checkbox", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Linked.md",
      date: "2026-07-09",
      title: "Linked note",
      body: "Body preview",
      bodyStartLine: 7,
      tags: [],
      related: ["task:vault:Inbox.md:3:hash"],
      sourceKind: "hybrid",
      createdAt: "2026-07-09T22:13:00"
    });
    const task = relatedTask({ text: "Prepare meeting deck" });
    const onTaskComplete = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      { getRelatedTasks: () => [task], onTaskComplete }
    );

    const status = childWithClass(container, "task-hub-dated-note-related-task-status");
    const event = status.click();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalledWith(task);
  });

  it("completes a preview task from the note list checkbox", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试输入任务",
      body: "测试输入任务\n- [ ] 第一项\n- [ ] 第二项",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });
    const task = relatedTask({
      id: "note-task-1",
      filePath: note.path,
      line: 8,
      rawLine: "- [ ] 第一项",
      text: "第一项"
    });
    const onTaskComplete = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        getNoteTask: (_note, sourceLine, rawLine) => (sourceLine === 8 && rawLine === "- [ ] 第一项" ? task : undefined),
        onTaskComplete
      }
    );

    const previewCheckbox = collect(container).find(
      (child) => child.classes.has("task-hub-dated-note-preview-checkbox") && !child.classes.has("task-hub-dated-note-related-task-status")
    );
    if (!previewCheckbox) throw new Error("Missing preview checkbox");
    const event = previewCheckbox.click();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalledWith(task);
  });

  it("keeps the related task preview when detail Markdown rendering replaces its own host container", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-12 1319 - Detail.md",
      date: "2026-07-12",
      title: "Detail note",
      body: "- [ ] 都doudod无论如何",
      bodyStartLine: 7,
      tags: [],
      related: ["task:vault:Inbox.md:3:hash"],
      sourceKind: "hybrid",
      createdAt: "2026-07-12T13:19:00"
    });
    const task = relatedTask({ text: "测试那个问题试试看" });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        getRelatedTasks: () => [task],
        renderNoteMarkdown: (host, body) => {
          host.empty();
          host.createEl("p", { text: body });
        }
      }
    );

    const detailBody = childWithClass(container, "task-hub-dated-note-body");
    expect(collect(detailBody).filter((child) => child.classes.has("task-hub-dated-note-related-task-text")).map((child) => child.text)).toContain(
      "测试那个问题试试看"
    );
    expect(collect(detailBody).map((child) => child.text)).toContain("- [ ] 都doudod无论如何");
  });

  it("completes a markdown-rendered body task from the detail pane checkbox", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-12 1319 - Detail.md",
      date: "2026-07-12",
      title: "Detail note",
      body: "- [ ] 第一项\n- [ ] 第二项",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-12T13:19:00"
    });
    const task = relatedTask({
      id: "note-task-1",
      filePath: note.path,
      line: 7,
      rawLine: "- [ ] 第一项",
      text: "第一项"
    });
    const onTaskComplete = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        getNoteTask: (_note, sourceLine, rawLine) => (sourceLine === 7 && rawLine === "- [ ] 第一项" ? task : undefined),
        onTaskComplete,
        renderNoteMarkdown: (host) => {
          host.createEl("input", { cls: "task-list-item-checkbox" });
          host.createEl("input", { cls: "task-list-item-checkbox" });
        }
      }
    );

    const markdown = childWithClass(container, "task-hub-dated-note-markdown");
    const checkbox = childWithClass(markdown, "task-list-item-checkbox");
    const event = { target: checkbox, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    markdown.dispatch("click", event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalledWith(task);
  });

  it("toggles an unindexed markdown-rendered body checkbox from the detail pane", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-12 1319 - Detail.md",
      date: "2026-07-12",
      title: "Detail note",
      body: "- [ ] 第一项\n- [x] 第二项",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-12T13:19:00"
    });
    const onNoteCheckboxToggle = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        getNoteTask: () => undefined,
        onNoteCheckboxToggle,
        renderNoteMarkdown: (host) => {
          host.createEl("input", { cls: "task-list-item-checkbox" });
          host.createEl("input", { cls: "task-list-item-checkbox" });
        }
      }
    );

    const markdown = childWithClass(container, "task-hub-dated-note-markdown");
    const checkbox = childWithClass(markdown, "task-list-item-checkbox");
    const event = { target: checkbox, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    markdown.dispatch("click", event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onNoteCheckboxToggle).toHaveBeenCalledWith(note, 7, "- [ ] 第一项", true);
  });

  it("toggles an unindexed preview task checkbox from the note list", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-12 1319 - Preview.md",
      date: "2026-07-12",
      title: "Preview note",
      body: "- [x] 第一项",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-12T13:19:00"
    });
    const onNoteCheckboxToggle = jest.fn();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers(),
      {
        getNoteTask: () => undefined,
        onNoteCheckboxToggle
      }
    );

    const previewCheckbox = collect(container).find(
      (child) => child.classes.has("task-hub-dated-note-preview-checkbox") && !child.classes.has("task-hub-dated-note-related-task-status")
    );
    if (!previewCheckbox) throw new Error("Missing preview checkbox");
    const event = previewCheckbox.click();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onNoteCheckboxToggle).toHaveBeenCalledWith(note, 7, "- [x] 第一项", false);
  });

  it("renders a missing related task fallback when the linked task key no longer resolves", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-12 1310 - Missing.md",
      date: "2026-07-12",
      title: "Missing linked task",
      body: "- [ ] Missing linked task",
      bodyStartLine: 7,
      tags: [],
      related: ["task:vault:Projects/Daily.md:15:hash"],
      sourceKind: "task-note",
      createdAt: "2026-07-12T13:10:00"
    });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key },
      datedNoteHandlers()
    );

    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-related-task"))).toHaveLength(1);
    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-related-task-text")).map((child) => child.text)).toContain(
      "datedNoteRelatedTaskMissing"
    );
    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-related-task-meta")).map((child) => child.text)).toContain(
      "vaultTasks · Projects/Daily.md:15"
    );
  });

  it("shows all notes from the selected day in the detail pane", () => {
    const container = new FakeElement();
    const selected = makeTimelineNote({
      path: "Notes/selected.md",
      date: "2026-07-09",
      title: "Selected",
      body: "Selected body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });
    const sameDay = makeTimelineNote({
      path: "Notes/same-day.md",
      date: "2026-07-09",
      title: "Same day",
      body: "Same day body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T21:54:00"
    });
    const otherDay = makeTimelineNote({
      path: "Notes/other-day.md",
      date: "2026-07-07",
      title: "Other day",
      body: "Other day body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T21:54:00"
    });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [selected, sameDay, otherDay],
      { query: "", selectedPath: selected.path, t: (key) => key, detailStartIndex: 0, detailEndIndex: 0 },
      datedNoteHandlers()
    );

    const detail = childWithClass(container, "task-hub-dated-note-detail");
    const detailChildren = collect(detail);
    const detailCards = detailChildren.filter((child) => child.classes.has("task-hub-dated-note-detail-card"));
    expect(detailCards).toHaveLength(2);
    expect(detailChildren.map((child) => child.text)).toEqual(expect.arrayContaining(["Selected body", "Same day body"]));
    expect(detailChildren.map((child) => child.text)).not.toContain("Other day body");
  });

  it("renders multiple left-side day groups in descending order when the detail window spans them", () => {
    const container = new FakeElement();
    const notes: TimelineHubNote[] = [
      makeTimelineNote({
        path: "Notes/2026-07-09 2213 - Selected.md",
        date: "2026-07-09",
        title: "Selected",
        body: "Selected body",
        bodyStartLine: 7,
        tags: [],
        createdAt: "2026-07-09T22:13:00"
      }),
      makeTimelineNote({
        path: "Notes/2026-07-08 0910 - Middle.md",
        date: "2026-07-08",
        title: "Middle",
        body: "Middle body",
        bodyStartLine: 7,
        tags: [],
        createdAt: "2026-07-08T09:10:00"
      }),
      makeTimelineNote({
        path: "Notes/2026-07-07 0800 - Older.md",
        date: "2026-07-07",
        title: "Older",
        body: "Older body",
        bodyStartLine: 7,
        tags: [],
        createdAt: "2026-07-07T08:00:00"
      })
    ];

    renderDatedNotesView(
      container as unknown as HTMLElement,
      notes,
      { query: "", selectedPath: notes[0].path, t: (key) => key, detailStartIndex: 0, detailEndIndex: 2 },
      datedNoteHandlers()
    );

    expect(collect(container).filter((child) => child.classes.has("task-hub-dated-note-detail-day")).map((child) => child.attrs.get("data-task-hub-note-date"))).toEqual([
      "2026-07-09",
      "2026-07-08",
      "2026-07-07"
    ]);
  });

  it("opens note actions from the detail card menu button", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-09 2213 - Tasks.md",
      date: "2026-07-09",
      title: "测试输入任务",
      body: "测试输入任务",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-09T22:13:00"
    });
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

  it("requests more right-side dates when the list scroll reaches the end", () => {
    const container = new FakeElement();
    const onReachListEnd = jest.fn();
    const notes: TimelineHubNote[] = Array.from({ length: 14 }, (_, index) =>
      makeTimelineNote({
        path: `Notes/2026-07-${String(index + 1).padStart(2, "0")} 0900 - ${index}.md`,
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        title: `Note ${index}`,
        body: `Body ${index}`,
        bodyStartLine: 7,
        tags: [],
        createdAt: `2026-07-${String(index + 1).padStart(2, "0")}T09:00:00`
      })
    ).reverse();

    renderDatedNotesView(
      container as unknown as HTMLElement,
      notes,
      { query: "", selectedPath: notes[0].path, t: (key) => key, listVisibleCount: 12 },
      datedNoteHandlers({ onReachListEnd })
    );

    const list = childWithClass(container, "task-hub-dated-note-list");
    list.scrollTop = 520;
    list.clientHeight = 400;
    list.scrollHeight = 1000;
    list.dispatch("scroll");

    expect(onReachListEnd).toHaveBeenCalled();
  });

  it("marks the detail pane for a lightweight transition when requested", () => {
    const container = new FakeElement();
    const note = makeTimelineNote({
      path: "Notes/2026-07-07 0930 - Morning.md",
      date: "2026-07-07",
      title: "Morning note",
      body: "A compact note body",
      bodyStartLine: 7,
      tags: [],
      createdAt: "2026-07-07T09:30:00.000Z"
    });

    renderDatedNotesView(
      container as unknown as HTMLElement,
      [note],
      { query: "", selectedPath: note.path, t: (key) => key, animateDetailTransition: true },
      datedNoteHandlers()
    );

    expect(childWithClass(container, "task-hub-dated-note-detail").classes.has("is-note-transition")).toBe(true);
  });
});
