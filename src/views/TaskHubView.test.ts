import {
  TaskHubView,
  buildTaskViewTransitionKey,
  buildSavedSmartList,
  createTaskHubSessionSnapshot,
  collectCalendarUnscheduledTasks,
  clearTaskViewFilters,
  collectUnscheduledTasks,
  reconcileVisibleTaskSelection,
  restoreContentScrollAfterRender,
  restoreTaskHubSessionState,
  scrollExpandedTaskIntoView,
  shouldHandleTaskHubUndoShortcut
} from "./TaskHubView";
import type { TaskFilterState } from "../filtering/filters";
import type { TaskHubSmartList, TaskViewFilterSettings } from "../types";
import type { TaskItem } from "../types";

jest.mock("obsidian", () => ({
  AbstractInputSuggest: class {},
  ButtonComponent: class {},
  ItemView: class {},
  MarkdownRenderer: { render: jest.fn() },
  Modal: class {},
  Notice: class {},
  Setting: class {},
  WorkspaceLeaf: class {}
}), { virtual: true });

const NOW = new Date("2026-06-04T12:00:00");

describe("collectUnscheduledTasks", () => {
  it("applies the existing task filters before listing unscheduled tasks", () => {
    const tasks = [
      task({ id: "match", text: "Write proposal", tags: ["#work"], source: "vault" }),
      task({ id: "wrong-text", text: "Buy milk", tags: ["#work"], source: "vault" }),
      task({ id: "wrong-tag", text: "Write notes", tags: ["#home"], source: "vault" }),
      task({ id: "scheduled", text: "Write scheduled", tags: ["#work"], source: "vault", dueDate: "2026-06-05" }),
      task({ id: "done", text: "Write done", tags: ["#work"], source: "vault", completed: true })
    ];

    const result = collectUnscheduledTasks(tasks, {
      ...baseFilters(),
      tags: ["#work"],
      textQuery: "write"
    }, NOW, () => true);

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  it("shows completed unscheduled tasks only when the status filter allows them", () => {
    const tasks = [
      task({ id: "open", completed: false }),
      task({ id: "done", completed: true })
    ];

    expect(collectUnscheduledTasks(tasks, baseFilters(), NOW, () => true).map((item) => item.id)).toEqual(["open"]);
    expect(collectUnscheduledTasks(tasks, { ...baseFilters(), status: "all" }, NOW, () => true).map((item) => item.id)).toEqual(["open", "done"]);
  });
});

describe("collectCalendarUnscheduledTasks", () => {
  it("keeps a just-completed unscheduled task available for its row exit animation", () => {
    const tasks = [
      task({ id: "open", completed: false }),
      task({ id: "done", completed: true })
    ];

    const result = collectCalendarUnscheduledTasks(tasks, baseFilters(), NOW, () => true, new Set(["done"]));

    expect(result.map((item) => item.id)).toEqual(["open", "done"]);
  });
});

describe("TaskHubView completion viewport preservation", () => {
  it("captures task and content scroll before completing a task from the list view", async () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        taskListManualOrder: {},
        taskNoteManualOrder: {},
        taskNotePinned: {},
        taskNotes: {
          enabled: false,
          linkedNoteSubtasksEnabled: false,
          thinoIntegrationEnabled: false,
          showCountsInTaskList: false
        },
        localApple: {
          remindersWritebackEnabled: false,
          remindersEnabled: false,
          remindersColor: "#f59e0b",
          enabled: false,
          calendarReminderConversionEnabled: false
        },
        dida: {
          tasksWritebackEnabled: false,
          tasksDragRescheduleEnabled: false,
          tasksDeleteEnabled: false,
          tasksColor: "#3b82f6"
        },
        showSubtaskProgressBars: true
      },
      completeTask: jest.fn(async () => ({ status: "updated", content: "", line: 0 })),
      getTasks: jest.fn(() => []),
      getCalendarSources: jest.fn(() => []),
      taskIndex: { getStats: jest.fn(() => ({ totalTasks: 0, indexedFiles: 0, skippedFiles: 0 })) },
      settingsLocal: {},
      getAppleReminderListColors: jest.fn(() => ({})),
      getDidaProjectColors: jest.fn(() => ({})),
      getAppleReminderLists: jest.fn(() => []),
      getDidaProjects: jest.fn(() => []),
      defaultTaskSendTarget: jest.fn(() => undefined),
      canCreateAppleReminders: jest.fn(() => false),
      canCreateDidaTasks: jest.fn(() => false),
      canConvertAppleCalendarAndReminders: jest.fn(() => false),
      getTaskNoteCount: jest.fn(() => 0),
      getTaskNotes: jest.fn(() => []),
      getOrderedTaskNotes: jest.fn(() => []),
      isTaskNotePinned: jest.fn(() => false),
      jumpToTask: jest.fn(),
      sendTaskToAppleReminders: jest.fn(),
      sendTaskToDida: jest.fn(),
      convertAppleReminderToCalendarEvent: jest.fn(),
      moveAppleReminderToList: jest.fn(),
      moveDidaTaskToProject: jest.fn(),
      rescheduleTask: jest.fn(),
      reorderTaskListDate: jest.fn(),
      reorderTaskNotes: jest.fn(),
      toggleTaskNotePinned: jest.fn(),
      updateCalendarTask: jest.fn(),
      deleteCalendarTask: jest.fn(),
      sendTaskToTarget: jest.fn(),
      createTaskNoteForTask: jest.fn(),
      openTaskNote: jest.fn(),
      deleteTaskNote: jest.fn(),
      openTaskNoteSource: jest.fn()
    } as never;
    const view = new TaskHubView({} as never, plugin);
    const captureTaskListScroll = jest.spyOn(view as never, "captureTaskListScroll");
    const captureContentScroll = jest.spyOn(view as never, "captureContentScroll");
    const listPane = { scrollTop: 320 };
    const setTimeoutSpy = jest.fn(() => 1 as unknown as ReturnType<typeof setTimeout>);
    const contentContainer = {
      scrollTop: 180,
      querySelector: jest.fn(() => listPane)
    };
    Object.assign(view, {
      containerEl: {
        win: { setTimeout: setTimeoutSpy, clearTimeout: jest.fn() },
        children: [{}, contentContainer]
      }
    });

    await completeTaskFromView(view, task({ id: "task-1", completed: false }));

    expect(captureTaskListScroll).toHaveBeenCalled();
    expect(captureContentScroll).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 360);
  });

  it("selects the acted-on task before completing it from the list view", async () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        taskListManualOrder: {},
        taskNoteManualOrder: {},
        taskNotePinned: {},
        taskNotes: {
          enabled: false,
          linkedNoteSubtasksEnabled: false,
          thinoIntegrationEnabled: false,
          showCountsInTaskList: false
        },
        localApple: {
          remindersWritebackEnabled: false,
          remindersEnabled: false,
          remindersColor: "#f59e0b",
          enabled: false,
          calendarReminderConversionEnabled: false
        },
        dida: {
          tasksWritebackEnabled: false,
          tasksDragRescheduleEnabled: false,
          tasksDeleteEnabled: false,
          tasksColor: "#3b82f6"
        },
        showSubtaskProgressBars: true
      },
      completeTask: jest.fn(async () => ({ status: "updated", content: "", line: 0 })),
      getTasks: jest.fn(() => []),
      getCalendarSources: jest.fn(() => []),
      taskIndex: { getStats: jest.fn(() => ({ totalTasks: 0, indexedFiles: 0, skippedFiles: 0 })) },
      getAppleReminderListColors: jest.fn(() => ({})),
      getDidaProjectColors: jest.fn(() => ({})),
      getAppleReminderLists: jest.fn(() => []),
      getDidaProjects: jest.fn(() => []),
      defaultTaskSendTarget: jest.fn(() => undefined),
      canCreateAppleReminders: jest.fn(() => false),
      canCreateDidaTasks: jest.fn(() => false),
      canConvertAppleCalendarAndReminders: jest.fn(() => false),
      getTaskNoteCount: jest.fn(() => 0),
      getTaskNotes: jest.fn(() => []),
      getOrderedTaskNotes: jest.fn(() => []),
      isTaskNotePinned: jest.fn(() => false),
      jumpToTask: jest.fn(),
      sendTaskToAppleReminders: jest.fn(),
      sendTaskToDida: jest.fn(),
      convertAppleReminderToCalendarEvent: jest.fn(),
      moveAppleReminderToList: jest.fn(),
      moveDidaTaskToProject: jest.fn(),
      rescheduleTask: jest.fn(),
      reorderTaskListDate: jest.fn(),
      reorderTaskNotes: jest.fn(),
      toggleTaskNotePinned: jest.fn(),
      updateCalendarTask: jest.fn(),
      deleteCalendarTask: jest.fn(),
      sendTaskToTarget: jest.fn(),
      createTaskNoteForTask: jest.fn(),
      openTaskNote: jest.fn(),
      deleteTaskNote: jest.fn(),
      openTaskNoteSource: jest.fn()
    } as never;
    const view = new TaskHubView({} as never, plugin);
    const updateTaskSelection = jest.spyOn(view as never, "updateTaskSelection");
    const setTimeoutSpy = jest.fn(() => 1 as unknown as ReturnType<typeof setTimeout>);
    const contentContainer = {
      scrollTop: 180,
      querySelector: jest.fn(() => ({ scrollTop: 320 }))
    };
    Object.assign(view, {
      containerEl: {
        win: { setTimeout: setTimeoutSpy, clearTimeout: jest.fn() },
        children: [{}, contentContainer]
      }
    });
    const targetTask = task({ id: "task-2", completed: false });

    await completeTaskFromView(view, targetTask);

    expect(updateTaskSelection).toHaveBeenCalledWith(targetTask);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 360);
  });
});

describe("restoreContentScrollAfterRender", () => {
  it("restores the saved content scroll position after calendar or tag rerenders", () => {
    const container = { scrollTop: 0 } as HTMLElement;

    restoreContentScrollAfterRender(container, { preserveScroll: true, scrollTop: 280 });

    expect(container.scrollTop).toBe(280);
  });

  it("leaves ordinary rerenders at their natural scroll position", () => {
    const container = { scrollTop: 12 } as HTMLElement;

    restoreContentScrollAfterRender(container, { scrollTop: 280 });

    expect(container.scrollTop).toBe(12);
  });
});

describe("Task Hub session state", () => {
  it("clears every task filter field from the condition panel clear action", () => {
    expect(clearTaskViewFilters({
      status: "all",
      dateBucket: "today",
      tags: ["#work"],
      tagQuery: "#focus",
      sourceQuery: "apple-reminders",
      textQuery: "proposal",
      conditions: { operator: "or", tag: "#client", dateBucket: "tomorrow", text: "call" }
    })).toEqual({
      status: "open",
      tags: [],
      tagQuery: "",
      sourceQuery: "",
      textQuery: "",
      conditions: { operator: "and", tag: "", dateBucket: "", text: "" }
    });
  });

  it("restores the last closed view state ahead of the default view", () => {
    const restored = restoreTaskHubSessionState(
      {
        defaultView: "tasks",
        taskViewFilters: fallbackFilters(),
        lastSessionState: {
          view: "calendar",
          taskViewFilters: {
            status: "all",
            tags: ["#work"],
            sourceQuery: "apple-reminders",
            textQuery: "invoice"
          },
          calendarMode: "week",
          calendarFocusDate: "2026-06-04T08:30:00.000Z",
          visibleSourceIds: ["vault", "apple-reminders"],
          unscheduledPanelOpen: true
        }
      },
      () => new Date("2026-06-01T00:00:00.000Z")
    );

    expect(restored.view).toBe("calendar");
    expect(restored.filters).toEqual({
      status: "all",
      tags: ["#work"],
      conditions: undefined,
      sourceQuery: "apple-reminders",
      textQuery: "invoice"
    });
    expect(restored.calendarMode).toBe("week");
    expect(restored.calendarFocusDate.toISOString()).toBe("2026-06-04T08:30:00.000Z");
    expect([...restored.visibleSourceIds]).toEqual(["vault", "apple-reminders"]);
    expect(restored.unscheduledPanelOpen).toBe(true);
  });

  it("falls back to the default open state when no last session is stored", () => {
    const restored = restoreTaskHubSessionState(
      {
        defaultView: "tags",
        taskViewFilters: fallbackFilters()
      },
      () => new Date("2026-06-01T00:00:00.000Z")
    );

    expect(restored.view).toBe("tags");
    expect(restored.filters).toEqual(fallbackFilters());
    expect(restored.calendarMode).toBe("month");
    expect(restored.calendarFocusDate.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect([...restored.visibleSourceIds]).toEqual(["vault"]);
    expect(restored.unscheduledPanelOpen).toBe(false);
  });

  it("serializes the current view state into persisted settings data", () => {
    const snapshot = createTaskHubSessionSnapshot({
      view: "calendar",
      filters: {
        status: "all",
        tags: ["#ops"],
        tagQuery: "#focus",
        sourceQuery: "dida",
        textQuery: "follow up",
        conditions: { operator: "or", tag: "#client", dateBucket: "today", text: "ping" }
      },
      calendarMode: "day",
      calendarFocusDate: new Date("2026-06-09T09:15:00.000Z"),
      visibleSourceIds: new Set(["vault", "dida"]),
      unscheduledPanelOpen: true
    });

    expect(snapshot).toEqual({
      view: "calendar",
      taskViewFilters: {
        status: "all",
        tags: ["#ops"],
        tagQuery: "#focus",
        sourceQuery: "dida",
        textQuery: "follow up",
        conditions: { operator: "or", tag: "#client", dateBucket: "today", text: "ping" }
      },
      calendarMode: "day",
      calendarFocusDate: "2026-06-09T09:15:00.000Z",
      visibleSourceIds: ["vault", "dida"],
      unscheduledPanelOpen: true
    });
  });

  it("persists updated layer visibility and calendar session state immediately", () => {
    const settings = {
      defaultView: "tasks",
      taskViewFilters: fallbackFilters(),
      lastSessionState: undefined
    };
    const saveData = jest.fn(async () => undefined);
    const view = new TaskHubView({} as never, { settings, saveData } as never);
    Object.assign(view as never, {
      view: "calendar",
      filters: {
        status: "all",
        tags: ["#ops"],
        sourceQuery: "",
        textQuery: "follow up"
      },
      calendarMode: "week",
      calendarFocusDate: new Date("2026-06-17T09:30:00.000Z"),
      visibleSourceIds: new Set(["vault", "apple-calendar:work"]),
      unscheduledPanelOpen: true
    });

    (view as unknown as { persistSessionState: () => void }).persistSessionState();

    expect(settings.lastSessionState).toEqual({
      view: "calendar",
      taskViewFilters: {
        status: "all",
        tags: ["#ops"],
        conditions: undefined,
        sourceQuery: "",
        textQuery: "follow up"
      },
      calendarMode: "week",
      calendarFocusDate: "2026-06-17T09:30:00.000Z",
      visibleSourceIds: ["vault", "apple-calendar:work"],
      unscheduledPanelOpen: true
    });
    expect(saveData).toHaveBeenCalledWith(settings);
  });

  it("seeds known calendar layers from current sources so hidden layers are not auto-restored on reopen", () => {
    const settings = {
      defaultView: "tasks",
      taskViewFilters: fallbackFilters(),
      lastSessionState: {
        view: "calendar",
        taskViewFilters: fallbackFilters(),
        calendarMode: "week",
        calendarFocusDate: "2026-06-17T09:30:00.000Z",
        visibleSourceIds: ["vault"],
        unscheduledPanelOpen: false
      }
    };
    const plugin = {
      settings,
      getCalendarSources: jest.fn(() => [
        { id: "apple-reminders" },
        { id: "apple-calendar:work" }
      ])
    };

    const view = new TaskHubView({} as never, plugin as never);

    expect([...(view as unknown as { visibleSourceIds: Set<string> }).visibleSourceIds]).toEqual(["vault"]);
    expect([...(view as unknown as { knownCalendarSourceIds: Set<string> }).knownCalendarSourceIds]).toEqual([
      "vault",
      "apple-reminders",
      "apple-calendar:work"
    ]);
  });
});

describe("buildSavedSmartList", () => {
  it("builds a persisted smart list from the current filters and selected tasks", () => {
    const result = buildSavedSmartList({
      existingSmartLists: [],
      filters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#client",
        sourceQuery: "apple-reminders",
        textQuery: "proposal"
      },
      name: "  Focus  ",
      selectedTasks: [
        task({ id: "task-1", stableId: "vault:th_task1" }),
        task({ id: "task-2" })
      ],
      now: new Date("2026-06-30T12:00:00.000Z"),
      createId: () => "smart_focus"
    });

    expect(result).toEqual({
      id: "smart_focus",
      name: "Focus",
      filters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#client",
        sourceQuery: "apple-reminders",
        textQuery: "proposal"
      },
      taskStableIds: ["vault:th_task1"],
      taskIds: ["task-2"],
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z"
    });
  });

  it("does not create a smart list without a name", () => {
    expect(buildSavedSmartList({
      existingSmartLists: [],
      filters: fallbackFilters(),
      name: "   ",
      selectedTasks: [],
      now: new Date("2026-06-30T12:00:00.000Z"),
      createId: () => "smart_focus"
    })).toBeUndefined();
  });
});

describe("TaskHubView smart list interactions", () => {
  function smartList(overrides: Partial<TaskHubSmartList> = {}): TaskHubSmartList {
    return {
      id: "smart_focus",
      name: "Focus",
      filters: fallbackFilters(),
      taskStableIds: ["vault:th_focus"],
      taskIds: [],
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z",
      ...overrides
    };
  }

  it("toggles the active smart list off when clicking the selected list again", () => {
    const list = smartList();
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { applySmartList(smartList: typeof list, allTasks: TaskItem[]): void }).applySmartList(list, [
      task({ id: "task-1", stableId: "vault:th_focus" })
    ]);
    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBe("smart_focus");

    (view as unknown as { applySmartList(smartList: typeof list, allTasks: TaskItem[]): void }).applySmartList(list, [
      task({ id: "task-1", stableId: "vault:th_focus" })
    ]);

    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBeUndefined();
    expect([...(view as unknown as { selectedTaskIds: Set<string> }).selectedTaskIds]).toEqual([]);
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("activates a smart list without mutating the current task filters", () => {
    const currentFilters: TaskViewFilterSettings = {
      status: "open",
      tags: [],
      tagQuery: "#inbox",
      sourceQuery: "",
      textQuery: ""
    };
    const list = smartList({
      filters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#client",
        sourceQuery: "vault",
        textQuery: "proposal"
      }
    });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: currentFilters,
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { applySmartList(smartList: typeof list, allTasks: TaskItem[]): void }).applySmartList(list, [
      task({ id: "task-1", stableId: "vault:th_focus" })
    ]);

    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBe("smart_focus");
    expect((view as unknown as { filters: TaskViewFilterSettings }).filters).toEqual(currentFilters);
    expect(plugin.settings.taskViewFilters).toEqual(currentFilters);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("deletes a smart list without leaving active selection references behind", async () => {
    const list = smartList();
    const other = smartList({ id: "smart_other", name: "Other", taskStableIds: [] });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list, other]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, {
      containerEl: {
        win: { confirm: jest.fn(() => true) }
      }
    });

    (view as unknown as { applySmartList(smartList: typeof list, allTasks: TaskItem[]): void }).applySmartList(list, [
      task({ id: "task-1", stableId: "vault:th_focus" })
    ]);
    expect([...(view as unknown as { selectedTaskIds: Set<string> }).selectedTaskIds]).toEqual(["task-1"]);

    (view as unknown as { deleteSmartList(smartList: typeof list): void }).deleteSmartList(list);
    await Promise.resolve();

    expect(plugin.settings.smartLists.map((item) => item.id)).toEqual(["smart_other"]);
    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBeUndefined();
    expect((view as unknown as { selectedTaskId?: string }).selectedTaskId).toBeUndefined();
    expect((view as unknown as { selectedTaskStableId?: string }).selectedTaskStableId).toBeUndefined();
    expect([...(view as unknown as { selectedTaskIds: Set<string> }).selectedTaskIds]).toEqual([]);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("persists smart list color changes", async () => {
    const list = smartList();
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { updateSmartListColor(smartList: typeof list, color: string | undefined): void }).updateSmartListColor(list, "#6f94b8");
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      color: "#6f94b8"
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("adds dropped tasks to a smart list with stable references first", async () => {
    const list = smartList({
      taskStableIds: ["vault:th_existing"],
      taskIds: ["runtime-old"],
      excludedTaskStableIds: ["vault:th_new"],
      excludedTaskIds: ["runtime-only"]
    });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { addTasksToSmartList(smartList: typeof list, tasks: TaskItem[]): void }).addTasksToSmartList(list, [
      task({ id: "runtime-stable", stableId: "vault:th_new" }),
      task({ id: "runtime-only" })
    ]);
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      taskStableIds: ["vault:th_existing", "vault:th_new"],
      taskIds: ["runtime-old", "runtime-only"],
      excludedTaskStableIds: [],
      excludedTaskIds: []
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("removes dropped tasks from the active smart list using exclusion references", async () => {
    const list = smartList({ taskStableIds: ["vault:th_existing", "vault:th_remove"], taskIds: ["runtime-only"] });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, {
      activeSmartListId: "smart_focus",
      selectedTaskId: "remove-stable",
      selectedTaskStableId: "vault:th_remove",
      selectedTaskIds: new Set(["remove-stable", "runtime-only"])
    });

    (view as unknown as { removeTasksFromActiveSmartList(tasks: TaskItem[]): void }).removeTasksFromActiveSmartList([
      task({ id: "remove-stable", stableId: "vault:th_remove" }),
      task({ id: "runtime-only" })
    ]);
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      taskStableIds: ["vault:th_existing"],
      taskIds: [],
      excludedTaskStableIds: ["vault:th_remove"],
      excludedTaskIds: ["runtime-only"]
    });
    expect([...(view as unknown as { selectedTaskIds: Set<string> }).selectedTaskIds]).toEqual([]);
    expect((view as unknown as { selectedTaskId?: string }).selectedTaskId).toBeUndefined();
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("persists smart list renames", async () => {
    const list = smartList();
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { renameSmartList(smartList: typeof list, name: string): void }).renameSmartList(list, " Deep work ");
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      name: "Deep work"
    });
    expect(plugin.settings.smartLists[0].updatedAt).not.toBe(list.updatedAt);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});

describe("buildTaskViewTransitionKey", () => {
  it("changes only when task filtering or the active smart list changes", () => {
    const base = baseFilters();
    const sameTagsDifferentOrder = buildTaskViewTransitionKey({ ...base, tags: ["#b", "#a"] }, "smart_focus");
    const normalizedTags = buildTaskViewTransitionKey({ ...base, tags: ["#a", "#b"] }, "smart_focus");

    expect(sameTagsDifferentOrder).toBe(normalizedTags);
    expect(buildTaskViewTransitionKey({ ...base, textQuery: "call" }, "smart_focus")).not.toBe(normalizedTags);
    expect(buildTaskViewTransitionKey({ ...base, tags: ["#a", "#b"] }, undefined)).not.toBe(normalizedTags);
  });
});

describe("reconcileVisibleTaskSelection", () => {
  it("keeps task details focused on the same stable task after a save changes the volatile task id", () => {
    const previousTask = task({
      id: "Inbox.md:0:oldhash",
      stableId: "vault:th_current",
      text: "Before edit"
    });
    const updatedTask = task({
      id: "Inbox.md:0:newhash",
      stableId: "vault:th_current",
      text: "After edit"
    });

    const selection = reconcileVisibleTaskSelection(
      [updatedTask],
      previousTask.id,
      previousTask.stableId,
      new Set([previousTask.id])
    );

    expect(selection.selectedTaskId).toBe(updatedTask.id);
    expect(selection.selectedTaskStableId).toBe(updatedTask.stableId);
    expect([...selection.selectedTaskIds]).toEqual([updatedTask.id]);
  });

  it("falls back to another still-visible selected task when the previous primary selection disappears", () => {
    const visibleTask = task({ id: "visible", stableId: "vault:th_visible", text: "Visible task" });

    const selection = reconcileVisibleTaskSelection(
      [visibleTask],
      "missing",
      "vault:th_missing",
      new Set(["missing", visibleTask.id])
    );

    expect(selection.selectedTaskId).toBe(visibleTask.id);
    expect(selection.selectedTaskStableId).toBe(visibleTask.stableId);
    expect([...selection.selectedTaskIds]).toEqual([visibleTask.id]);
  });
});

describe("scrollExpandedTaskIntoView", () => {
  it("smoothly scrolls the task list down when expanded subtasks would overflow below the viewport", () => {
    const row = elementRect({ top: 180, bottom: 228 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 232, bottom: 420 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 40, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 178, behavior: "smooth" });
  });

  it("scrolls upward when the expanded parent row sits above the visible area", () => {
    const row = elementRect({ top: 4, bottom: 52 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 56, bottom: 160 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 120, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 106, behavior: "smooth" });
  });

  it("does nothing when the expanded task and its subtasks are already fully visible", () => {
    const row = elementRect({ top: 80, bottom: 128 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 132, bottom: 220 }, { "data-parent-task-id": "parent" });
    const list = listElement({ top: 0, bottom: 300 }, 64, [row, subtree]);

    scrollExpandedTaskIntoView(list as unknown as HTMLElement, "parent");

    expect(list.scrollTo).not.toHaveBeenCalled();
    expect(list.scrollTop).toBe(64);
  });

  it("falls back to the outer scroll container when the row lives inside a non-scrolling list wrapper", () => {
    const row = elementRect({ top: 180, bottom: 228 }, { "data-task-id": "parent" });
    const subtree = elementRect({ top: 232, bottom: 420 }, { "data-parent-task-id": "parent" });
    const list = wrapperElement([row, subtree]);
    const outer = listElement({ top: 0, bottom: 300 }, 40, [list]);

    scrollExpandedTaskIntoView(outer as unknown as HTMLElement, "parent");

    expect(outer.scrollTo).toHaveBeenCalledWith({ top: 178, behavior: "smooth" });
  });
});

describe("shouldHandleTaskHubUndoShortcut", () => {
  it("handles ctrl/cmd+z inside Task Hub when focus is not in an editable field", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, key: "z" }))).toBe(true);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ metaKey: true, key: "Z" }))).toBe(true);
  });

  it("ignores undo shortcuts while typing in editable controls", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      ctrlKey: true,
      key: "z",
      target: editableTarget("input")
    }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      metaKey: true,
      key: "z",
      target: editableTarget("textarea")
    }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({
      ctrlKey: true,
      key: "z",
      target: editableTarget("div", true)
    }))).toBe(false);
  });

  it("ignores other modifier combinations and keys", () => {
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true, key: "z" }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, altKey: true, key: "z" }))).toBe(false);
    expect(shouldHandleTaskHubUndoShortcut(keyboardEvent({ ctrlKey: true, key: "y" }))).toBe(false);
  });
});

function baseFilters(): TaskFilterState {
  return {
    status: "open",
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: "",
    conditions: { operator: "and", tag: "", dateBucket: "", text: "" }
  };
}

function fallbackFilters(): TaskViewFilterSettings {
  return {
    status: "open",
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: ""
  };
}

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task",
    stableId: overrides.stableId,
    filePath: overrides.filePath ?? "Inbox.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate,
    source: overrides.source ?? "vault"
  };
}

function listElement(
  rect: { top: number; bottom: number },
  scrollTop: number,
  children: Array<ReturnType<typeof elementRect> | ReturnType<typeof wrapperElement>>
) {
  const list = {
    children,
    scrollTop,
    scrollTo: jest.fn(),
    scrollHeight: 800,
    clientHeight: rect.bottom - rect.top,
    getBoundingClientRect: () => ({ top: rect.top, bottom: rect.bottom })
  };
  for (const child of children) {
    child.parentElement = list;
  }
  return list;
}

function elementRect(
  rect: { top: number; bottom: number },
  attrs: Record<string, string>
) {
  return {
    attrs: new Map(Object.entries(attrs)),
    children: [] as unknown[],
    classes: new Set<string>(),
    parentElement: undefined as unknown,
    scrollIntoView: jest.fn(),
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    },
    getBoundingClientRect: () => ({ top: rect.top, bottom: rect.bottom })
  };
}

function wrapperElement(
  children: Array<ReturnType<typeof elementRect>>
) {
  const wrapper = {
    attrs: new Map<string, string>(),
    classes: new Set<string>(),
    children,
    parentElement: undefined as unknown,
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    },
    getBoundingClientRect: () => ({ top: 0, bottom: 0 })
  };
  for (const child of children) {
    child.parentElement = wrapper;
  }
  return wrapper;
}

function keyboardEvent(overrides: Partial<KeyboardEvent> & { target?: EventTarget | null }): KeyboardEvent {
  return {
    key: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...overrides
  } as KeyboardEvent;
}

function editableTarget(tagName: string, isContentEditable = false): EventTarget {
  return {
    tagName: tagName.toUpperCase(),
    isContentEditable
  } as unknown as EventTarget;
}

function completeTaskFromView(view: TaskHubView, task: TaskItem): Promise<void> {
  return (view as unknown as { completeTaskFromView(task: TaskItem): Promise<void> }).completeTaskFromView(task);
}
