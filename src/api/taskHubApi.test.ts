import type { CompletionResult } from "../indexing/taskActions";
import type { HubNote } from "../hubNotes";
import type { TaskItem } from "../types";
import { TaskHubApiV1, type TaskHubApiHost } from "./taskHubApi";

describe("TaskHubApiV1", () => {
  it("reports write capabilities from current settings and host checks", () => {
    const api = new TaskHubApiV1(createHost({
      settings: {
        ...TEST_SETTINGS,
        datedNotes: { ...TEST_SETTINGS.datedNotes, enabled: true },
        taskNotes: { ...TEST_SETTINGS.taskNotes, enabled: true }
      },
      canCreateAppleReminders: () => true
    }));

    expect(api.capabilities()).toMatchObject({
      version: 1,
      tasks: {
        list: true,
        createVault: true,
        createAppleReminders: true,
        createDida: false,
        completeVault: true
      },
      notes: {
        list: true,
        createDated: true,
        createTaskNote: true
      }
    });
  });

  it("lists tasks by status, date, tag, source, and text", () => {
    const tasks = [
      task({ stableId: "vault:one", text: "Write proposal", tags: ["#work"], dueDate: "2026-07-22" }),
      task({ stableId: "vault:two", text: "Buy milk", tags: ["#home"], dueDate: "2026-07-22", completed: true }),
      task({ stableId: "dida:three", source: "dida", text: "Write review", tags: ["#work"], dueDate: "2026-07-23" })
    ];
    const api = new TaskHubApiV1(createHost({ tasks }));

    const result = api.listTasks({
      status: "open",
      date: "2026-07-22",
      tags: ["work"],
      source: "vault",
      text: "proposal"
    });

    expect(result).toEqual({
      ok: true,
      data: {
        tasks: [
          expect.objectContaining({
            stableId: "vault:one",
            title: "Write proposal",
            date: "2026-07-22"
          })
        ]
      }
    });
  });

  it("creates a vault task through the host without exposing markdown writes", async () => {
    const createTaskForDate = jest.fn(async (_target, _text, _creationTarget, _notes, _alert, _recurrence, _until, _start, options) => {
      options?.onTaskCreated?.(task({
        stableId: "vault:created",
        text: "Send quote #client/acme",
        tags: ["#client/acme"],
        dueDate: "2026-07-22"
      }));
    });
    const api = new TaskHubApiV1(createHost({ createTaskForDate }));

    const result = await api.createTask({
      title: "Send quote",
      date: "2026-07-22",
      tags: ["client/acme"],
      target: { type: "vault" }
    });

    expect(createTaskForDate).toHaveBeenCalledWith(
      { dateKey: "2026-07-22" },
      "Send quote #client/acme",
      { type: "vault" },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.objectContaining({ onTaskCreated: expect.any(Function) })
    );
    expect(result).toEqual({
      ok: true,
      data: {
        task: expect.objectContaining({
          stableId: "vault:created",
          title: "Send quote #client/acme"
        })
      }
    });
  });

  it("returns a conflict error when safe completion fails", async () => {
    const completeTask = jest.fn(async (): Promise<CompletionResult> => ({ status: "conflict", message: "Line changed." }));
    const api = new TaskHubApiV1(createHost({
      tasks: [task({ stableId: "vault:task", completed: false })],
      completeTask
    }));

    const result = await api.completeTask("vault:task");

    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: {
        code: "conflict",
        message: "Line changed."
      }
    });
  });

  it("creates task notes without opening the task note UI", async () => {
    const sourceTask = task({ stableId: "vault:task", text: "Write proposal" });
    const createTaskNoteForTask = jest.fn(async (_task, options) => note({
      path: "Task Hub Notes/Proposal.md",
      title: "Write proposal",
      body: options?.body ?? "",
      related: ["task:vault:task"]
    }));
    const api = new TaskHubApiV1(createHost({
      tasks: [sourceTask],
      settings: {
        ...TEST_SETTINGS,
        taskNotes: { ...TEST_SETTINGS.taskNotes, enabled: true }
      },
      createTaskNoteForTask
    }));

    const result = await api.createTaskNote({ taskStableId: "vault:task", body: "Context" });

    expect(createTaskNoteForTask).toHaveBeenCalledWith(sourceTask, {
      body: "Context",
      openAfterCreate: false
    });
    expect(result).toEqual({
      ok: true,
      data: {
        note: expect.objectContaining({
          path: "Task Hub Notes/Proposal.md",
          related: ["task:vault:task"],
          body: "Context"
        })
      }
    });
  });
});

function createHost(overrides: Partial<TaskHubApiHost> & { tasks?: TaskItem[]; notes?: HubNote[] } = {}): TaskHubApiHost {
  const tasks = overrides.tasks ?? [];
  const notes = overrides.notes ?? [];
  return {
    settings: TEST_SETTINGS,
    getTasks: () => tasks,
    getHubNotes: () => notes,
    getHubNotesForTask: () => [],
    createTaskForDate: jest.fn(async (_target, _text, _creationTarget, _notes, _alert, _recurrence, _until, _start, options) => {
      options?.onTaskCreated?.(task());
    }),
    completeTask: jest.fn(async (): Promise<CompletionResult> => ({ status: "updated", content: "", line: 0 })),
    createDatedNote: jest.fn(async (_dateKey, body) => note({ body })),
    createTaskNoteForTask: jest.fn(async (_task, options) => note({ body: options?.body })),
    canCreateAppleReminders: () => false,
    canCreateDidaTasks: () => false,
    isLocalAppleSupported: () => true,
    ...overrides
  };
}

const TEST_SETTINGS = {
  datedNotes: {
    enabled: false,
    folder: "TaskHub/Notes",
    defaultTitleTemplate: "YYYY-MM-DD Note",
    openAfterCreate: false
  },
  taskNotes: {
    enabled: false,
    notesFolder: "Task Hub Notes",
    defaultMode: "task-hub",
    thinoIntegrationEnabled: false,
    addThinoIdToTaskHubNotes: false,
    thinoFolder: "Thino",
    openNoteAfterCreate: true,
    showCountsInTaskList: true,
    linkedNoteSubtasksEnabled: false
  },
  localApple: {
    enabled: false,
    remindersEnabled: false,
    remindersWritebackEnabled: false
  },
  dida: {
    enabled: false,
    tasksEnabled: false,
    tasksWritebackEnabled: false
  }
} as TaskHubApiHost["settings"];

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: overrides.id ?? overrides.stableId ?? "task-id",
    stableId: overrides.stableId,
    filePath: overrides.filePath ?? "Inbox.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Write proposal #work 📅 2026-07-22",
    text: overrides.text ?? "Write proposal",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? ["#work"],
    dueDate: overrides.dueDate ?? "2026-07-22",
    source: overrides.source ?? "vault",
    externalId: overrides.externalId,
    externalListId: overrides.externalListId
  };
}

function note(overrides: Partial<HubNote> = {}): HubNote {
  return {
    path: overrides.path ?? "TaskHub/Notes/2026-07-22.md",
    noteId: overrides.noteId ?? "thn_20260722000000_abcd",
    kind: overrides.kind ?? "manual",
    title: overrides.title ?? "Note",
    body: overrides.body ?? "",
    bodyStartLine: overrides.bodyStartLine ?? 10,
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? "2026-07-22T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-22T00:00:00.000Z",
    date: overrides.date,
    related: overrides.related ?? [],
    history: overrides.history ?? [],
    sourceKind: overrides.sourceKind ?? "dated-note"
  };
}
