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
  scrollDatedNoteDetailToTop,
  scrollExpandedTaskIntoView,
  shouldHandleTaskHubUndoShortcut,
  smartListCountsForTasks
} from "./TaskHubView";
import type { TaskFilterState } from "../filtering/filters";
import type { ExternalTaskListFilterEntry, TaskHubSmartList, TaskViewFilterSettings } from "../types";
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

describe("TaskHubView viewport restoration", () => {
  it("reapplies preserved task, content, and agenda scroll after layout settles", () => {
    const plugin = {
      settings: {
        defaultView: "calendar",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined
      },
      getCalendarSources: jest.fn(() => [])
    };
    const view = new TaskHubView({} as never, plugin as never);
    const listPane = { scrollTop: 0 };
    const allDaySlot = {
      scrollTop: 0,
      attrs: new Map([["data-task-hub-agenda-day", "2026-05-08"]]),
      classes: new Set(["task-hub-agenda-all-day-slot"]),
      children: [],
      classList: { contains: (className: string) => className === "task-hub-agenda-all-day-slot" },
      getAttribute(name: string) {
        return this.attrs.get(name) ?? null;
      }
    };
    const agenda = { scrollTop: 0, scrollLeft: 0, children: [allDaySlot] };
    const daySidebar = { scrollTop: 0 };
    const contentContainer = {
      scrollTop: 0,
      querySelector: jest.fn((selector: string) => {
        if (selector === ".task-hub-task-list-pane") return listPane;
        if (selector === ".task-hub-agenda") return agenda;
        if (selector === ".task-hub-calendar-day-sidebar") return daySidebar;
        return undefined;
      })
    };
    const animationFrameCallbacks: Array<() => void> = [];
    const timeoutCallbacks: Array<() => void> = [];
    Object.assign(view, {
      containerEl: {
        win: {
          requestAnimationFrame: jest.fn((callback: () => void) => {
            animationFrameCallbacks.push(callback);
            return 1;
          }),
          cancelAnimationFrame: jest.fn(),
          setTimeout: jest.fn((callback: () => void) => {
            timeoutCallbacks.push(callback);
            return timeoutCallbacks.length;
          }),
          clearTimeout: jest.fn()
        },
        children: [{}, contentContainer]
      },
      taskListScrollTop: 240,
      contentScrollTop: 180,
      calendarAgendaScrollPosition: { top: 360, left: 24, allDaySlotTops: { "2026-05-08": 72 } },
      calendarDaySidebarScrollTop: 128
    });

    (view as unknown as { scheduleViewportRestore(options: unknown): void }).scheduleViewportRestore({
      preserveTaskListScroll: true,
      preserveContentScroll: true,
      preserveCalendarAgendaScroll: true
    });
    contentContainer.scrollTop = 0;
    listPane.scrollTop = 0;
    agenda.scrollTop = 0;
    agenda.scrollLeft = 0;
    allDaySlot.scrollTop = 0;
    daySidebar.scrollTop = 0;

    animationFrameCallbacks.forEach((callback) => callback());
    timeoutCallbacks.forEach((callback) => callback());

    expect(contentContainer.scrollTop).toBe(180);
    expect(listPane.scrollTop).toBe(240);
    expect(agenda.scrollTop).toBe(360);
    expect(agenda.scrollLeft).toBe(24);
    expect(allDaySlot.scrollTop).toBe(72);
    expect(daySidebar.scrollTop).toBe(128);
  });
});

describe("scrollDatedNoteDetailToTop", () => {
  it("resets only the dated note detail pane after switching notes", () => {
    const detail = { scrollTop: 180 };
    const container = {
      scrollTop: 64,
      querySelector: jest.fn(() => detail)
    };

    scrollDatedNoteDetailToTop(container as unknown as HTMLElement);

    expect(detail.scrollTop).toBe(0);
    expect(container.scrollTop).toBe(64);
    expect(container.querySelector).toHaveBeenCalledWith(".task-hub-dated-note-detail");
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
          selectedExternalListFilterId: "apple-reminders:list:groceries",
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
    expect(restored.selectedExternalListFilterId).toBe("apple-reminders:list:groceries");
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
    expect(restored.selectedExternalListFilterId).toBeUndefined();
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
      selectedExternalListFilterId: "dida:project:today",
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
      selectedExternalListFilterId: "dida:project:today",
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
      selectedExternalListFilterId: "dida:project:today",
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
      selectedExternalListFilterId: "dida:project:today",
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
  it("builds a persisted smart list from concrete tasks", () => {
    const result = buildSavedSmartList({
      existingSmartLists: [],
      name: "  Focus  ",
      tasks: [
        task({ id: "task-1", stableId: "vault:th_task1" }),
        task({ id: "task-2" })
      ],
      now: new Date("2026-06-30T12:00:00.000Z"),
      createId: () => "smart_focus"
    });

    expect(result).toEqual({
      id: "smart_focus",
      name: "Focus",
      taskStableIds: ["vault:th_task1"],
      taskIds: ["task-2"],
      createdAt: "2026-06-30T12:00:00.000Z",
      updatedAt: "2026-06-30T12:00:00.000Z"
    });
  });

  it("does not create a smart list without a name", () => {
    expect(buildSavedSmartList({
      existingSmartLists: [],
      name: "   ",
      tasks: [],
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
    const list = smartList();
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

  it("keeps the active smart list when the status filter changes", () => {
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
    Object.assign(view, { activeSmartListId: "smart_focus" });

    (view as unknown as {
      updateFilters(filters: TaskViewFilterSettings, options?: unknown, updateOptions?: { keepActiveSmartList?: boolean }): void;
    }).updateFilters({ ...fallbackFilters(), status: "all" }, {}, { keepActiveSmartList: true });

    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBe("smart_focus");
    expect(plugin.settings.taskViewFilters.status).toBe("all");
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("does not auto-select smart list member tasks when applying a smart list", () => {
    const list = smartList({
      taskStableIds: ["vault:th_focus", "vault:th_other"],
      taskIds: []
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
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { applySmartList(smartList: typeof list, allTasks: TaskItem[]): void }).applySmartList(list, [
      task({ id: "task-1", stableId: "vault:th_focus" }),
      task({ id: "task-2", stableId: "vault:th_other" })
    ]);

    expect((view as unknown as { activeSmartListId?: string }).activeSmartListId).toBe("smart_focus");
    expect((view as unknown as { selectedTaskId?: string }).selectedTaskId).toBeUndefined();
    expect((view as unknown as { selectedTaskStableId?: string }).selectedTaskStableId).toBeUndefined();
    expect([...(view as unknown as { selectedTaskIds: Set<string> }).selectedTaskIds]).toEqual([]);
  });

  it("hides completed smart list tasks when the current view does not show completed tasks", () => {
    const currentFilters: TaskViewFilterSettings = {
      status: "open",
      tags: [],
      tagQuery: "",
      sourceQuery: "",
      textQuery: ""
    };
    const list = smartList({ taskStableIds: ["vault:th_open", "vault:th_manual_done"], taskIds: [] });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: currentFilters,
        lastSessionState: undefined,
        smartLists: [list],
        taskNotes: { enabled: false, linkedNoteSubtasksEnabled: false }
      }
    };
    const view = new TaskHubView({} as never, plugin as never);
    Object.assign(view, { activeSmartListId: "smart_focus" });

    const visibleTasks = (view as unknown as { taskViewVisibleTasks(tasks: TaskItem[], now: Date): TaskItem[] }).taskViewVisibleTasks([
      task({ id: "open-dynamic", stableId: "vault:th_open", tags: ["#work"], completed: false }),
      task({ id: "done-dynamic", stableId: "vault:th_done", tags: ["#work"], completed: true }),
      task({ id: "done-manual", stableId: "vault:th_manual_done", tags: ["#home"], completed: true })
    ], NOW);

    expect(visibleTasks.map((item) => item.id)).toEqual(["open-dynamic"]);
  });

  it("counts only open smart list tasks when the current view hides completed tasks", () => {
    const list = smartList({ taskStableIds: ["vault:th_open", "vault:th_done", "vault:th_manual_done"], taskIds: [] });
    const tasks = [
      task({ id: "open-dynamic", stableId: "vault:th_open", tags: ["#work"], completed: false }),
      task({ id: "done-dynamic", stableId: "vault:th_done", tags: ["#work"], completed: true }),
      task({ id: "done-manual", stableId: "vault:th_manual_done", tags: ["#home"], completed: true })
    ];

    expect(smartListCountsForTasks(tasks, [list], NOW, "open").get("smart_focus")).toBe(1);
    expect(smartListCountsForTasks(tasks, [list], NOW, "all").get("smart_focus")).toBe(3);
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
    Object.assign(view, {
      selectedTaskId: "task-1",
      selectedTaskStableId: "vault:th_focus",
      selectedTaskIds: new Set(["task-1"])
    });

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
      taskIds: ["runtime-old"]
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
      taskIds: ["runtime-old", "runtime-only"]
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("adds descendant tasks when a parent task is added to a smart list", async () => {
    const list = smartList({
      taskStableIds: [],
      taskIds: []
    });
    const parent = task({ id: "parent", stableId: "vault:th_parent", text: "Plan launch" });
    const child = task({ id: "child", stableId: "vault:th_child", parentId: "parent", indent: 1, text: "Draft announcement" });
    const grandchild = task({ id: "runtime-grandchild", parentId: "child", indent: 2, text: "Collect screenshots" });
    const unrelated = task({ id: "unrelated", stableId: "vault:th_unrelated", text: "Refill coffee" });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      getTasks: jest.fn(() => [parent, child, grandchild, unrelated]),
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);

    (view as unknown as { addTasksToSmartList(smartList: typeof list, tasks: TaskItem[]): void }).addTasksToSmartList(list, [parent]);
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      taskStableIds: ["vault:th_parent", "vault:th_child"],
      taskIds: ["runtime-grandchild"]
    });
    expect(plugin.settings.smartLists[0].taskStableIds).not.toContain("vault:th_unrelated");
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("adds tasks created from the toolbar to the active smart list", async () => {
    const list = smartList({
      taskStableIds: [],
      taskIds: []
    });
    const createdTask = task({ id: "created", stableId: "vault:th_created" });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      openCreateTaskModal: jest.fn(),
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, {
      activeSmartListId: "smart_focus"
    });

    (view as unknown as { openCreateTaskFromToolbar(): void }).openCreateTaskFromToolbar();
    const createOptions = plugin.openCreateTaskModal.mock.calls[0]?.[1];
    expect(createOptions?.onTaskCreated).toBeDefined();

    createOptions.onTaskCreated(createdTask);
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      taskStableIds: ["vault:th_created"],
      taskIds: []
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("adds tasks created from a date entry to the active smart list", async () => {
    const list = smartList({
      taskStableIds: [],
      taskIds: []
    });
    const createdTask = task({ id: "created-tomorrow", stableId: "vault:th_created_tomorrow" });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      openCreateTaskModal: jest.fn(),
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, {
      activeSmartListId: "smart_focus"
    });

    (view as unknown as { openCreateTaskForDate(target: string): void }).openCreateTaskForDate("2026-07-09");
    expect(plugin.openCreateTaskModal).toHaveBeenCalledWith("2026-07-09", expect.objectContaining({
      onTaskCreated: expect.any(Function)
    }));

    const createOptions = plugin.openCreateTaskModal.mock.calls[0]?.[1];
    createOptions.onTaskCreated(createdTask);
    await Promise.resolve();

    expect(plugin.settings.smartLists[0]).toMatchObject({
      id: "smart_focus",
      taskStableIds: ["vault:th_created_tomorrow"],
      taskIds: []
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });

  it("keeps timed date creation targets when binding the active smart list callback", () => {
    const list = smartList({
      taskStableIds: [],
      taskIds: []
    });
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [list]
      },
      openCreateTaskModal: jest.fn(),
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, {
      activeSmartListId: "smart_focus"
    });
    type TimedCreateTarget = { dateKey: string; startMinutes: number; durationMinutes: number };
    const target: TimedCreateTarget = {
      dateKey: "2026-07-09",
      startMinutes: 9 * 60,
      durationMinutes: 30
    };

    (view as unknown as { openCreateTaskForDate(createTarget: TimedCreateTarget): void }).openCreateTaskForDate(target);

    expect(plugin.openCreateTaskModal).toHaveBeenCalledWith(target, expect.objectContaining({
      onTaskCreated: expect.any(Function)
    }));
  });

  it("selects the created dated note in the notes view without opening a source tab", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [],
        datedNotes: { enabled: true }
      },
      openCreateTaskModal: jest.fn(),
      saveSettings: jest.fn(async () => undefined)
    };
    const view = new TaskHubView({} as never, plugin as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    Object.assign(view, { view: "notes" });

    (view as unknown as { openCreateTaskFromToolbar(): void }).openCreateTaskFromToolbar();
    const createOptions = plugin.openCreateTaskModal.mock.calls[0]?.[1];
    expect(createOptions.initialKind).toBe("note");
    createOptions.onDatedNoteCreated({
      path: "TaskHub/Notes/today.md",
      date: "2026-07-07",
      title: "Today",
      body: "Today",
      bodyStartLine: 10,
      tags: [],
      createdAt: "2026-07-07T10:00:00.000Z"
    });

    expect((plugin.settings.lastSessionState as { view?: string } | undefined)?.view).toBe("notes");
    expect(render).toHaveBeenLastCalledWith({ preserveContentScroll: true });
  });

  it("removes dropped tasks from the active smart list members", async () => {
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
      taskIds: []
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

describe("TaskHubView external list filters", () => {
  function externalListEntry(overrides: Partial<ExternalTaskListFilterEntry> = {}): ExternalTaskListFilterEntry {
    return {
      id: "apple-reminders:list:groceries",
      externalListId: "groceries",
      source: "apple-reminders",
      name: "Groceries",
      color: "#f59e0b",
      itemCount: 1,
      ...overrides
    };
  }

  it("filters the visible task list by the selected external list entry", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [],
        taskNotes: { enabled: false, linkedNoteSubtasksEnabled: false }
      }
    };
    const view = new TaskHubView({} as never, plugin as never);
    Object.assign(view, {
      selectedExternalListFilterId: "apple-reminders:list:groceries"
    });

    const visibleTasks = (view as unknown as {
      taskViewVisibleTasks(tasks: TaskItem[], now: Date, entries: ExternalTaskListFilterEntry[]): TaskItem[];
    }).taskViewVisibleTasks([
      task({
        id: "apple-match",
        source: "apple-reminders",
        externalListId: "groceries",
        text: "Buy fruit"
      }),
      task({
        id: "apple-other",
        source: "apple-reminders",
        externalListId: "errands",
        text: "Mail letter"
      }),
      task({
        id: "dida-other",
        source: "dida",
        externalListId: "groceries",
        text: "Plan sprint"
      })
    ], NOW, [externalListEntry()]);

    expect(visibleTasks.map((item) => item.id)).toEqual(["apple-match"]);
  });

  it("counts only open external tasks when the task view hides completed items", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [],
        localApple: {
          enabled: true,
          remindersEnabled: true,
          remindersColor: "#f59e0b"
        },
        dida: {
          enabled: true,
          tasksEnabled: true,
          tasksColor: "#3b82f6"
        }
      },
      getAppleReminderListColors: jest.fn(() => ({ groceries: "#f59e0b" })),
      getAppleReminderLists: jest.fn(() => [{ id: "groceries", name: "Groceries" }]),
      getDidaProjectColors: jest.fn(() => ({ work: "#3b82f6" })),
      getDidaProjects: jest.fn(() => [{ id: "work", name: "Work" }]),
      getTasks: jest.fn(() => [])
    };
    const view = new TaskHubView({} as never, plugin as never);

    const entries = (view as unknown as {
      externalTaskListEntries(tasks: readonly TaskItem[], includeCompleted: boolean): ExternalTaskListFilterEntry[];
    }).externalTaskListEntries([
      task({ id: "apple-1", source: "apple-reminders", externalListId: "groceries" }),
      task({ id: "apple-2", source: "apple-reminders", externalListId: "groceries", completed: true }),
      task({ id: "apple-3", source: "apple-reminders", externalListId: "other" }),
      task({ id: "dida-1", source: "dida", externalListId: "work" })
    ], false);

    expect(entries).toEqual([
      {
        id: "apple-reminders:list:groceries",
        externalListId: "groceries",
        source: "apple-reminders",
        name: "Groceries",
        color: "#f59e0b",
        itemCount: 1
      },
      {
        id: "dida:project:work",
        externalListId: "work",
        source: "dida",
        name: "Work",
        color: "#3b82f6",
        itemCount: 1
      }
    ]);
  });

  it("counts all external tasks when the task view includes completed items", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        smartLists: [],
        localApple: {
          enabled: true,
          remindersEnabled: true,
          remindersColor: "#f59e0b"
        },
        dida: {
          enabled: false,
          tasksEnabled: false,
          tasksColor: "#3b82f6"
        }
      },
      getAppleReminderListColors: jest.fn(() => ({ groceries: "#f59e0b" })),
      getAppleReminderLists: jest.fn(() => [{ id: "groceries", name: "Groceries" }]),
      getDidaProjectColors: jest.fn(() => ({})),
      getDidaProjects: jest.fn(() => []),
      getTasks: jest.fn(() => [])
    };
    const view = new TaskHubView({} as never, plugin as never);

    const entries = (view as unknown as {
      externalTaskListEntries(tasks: readonly TaskItem[], includeCompleted: boolean): ExternalTaskListFilterEntry[];
    }).externalTaskListEntries([
      task({ id: "apple-1", source: "apple-reminders", externalListId: "groceries" }),
      task({ id: "apple-2", source: "apple-reminders", externalListId: "groceries", completed: true })
    ], true);

    expect(entries).toEqual([
      {
        id: "apple-reminders:list:groceries",
        externalListId: "groceries",
        source: "apple-reminders",
        name: "Groceries",
        color: "#f59e0b",
        itemCount: 2
      }
    ]);
  });

  it("clears a persisted external list filter when the current external lists no longer contain it", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: {
          view: "tasks",
          taskViewFilters: fallbackFilters(),
          selectedExternalListFilterId: "apple-reminders:list:missing",
          calendarMode: "month",
          visibleSourceIds: ["vault"],
          unscheduledPanelOpen: false
        }
      }
    };
    const view = new TaskHubView({} as never, plugin as never);

    (view as unknown as {
      reconcileExternalListFilterSelection(entries: readonly ExternalTaskListFilterEntry[]): void;
    }).reconcileExternalListFilterSelection([externalListEntry()]);

    expect((view as unknown as { selectedExternalListFilterId?: string }).selectedExternalListFilterId).toBeUndefined();
    expect(plugin.settings.lastSessionState?.selectedExternalListFilterId).toBeUndefined();
  });

  it("filters hidden external list entries from the sidebar", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        hiddenExternalTaskListFilterIds: ["dida:project:work"]
      }
    };
    const view = new TaskHubView({} as never, plugin as never);
    const visibleEntries = (view as unknown as {
      visibleExternalTaskListEntries(entries: readonly ExternalTaskListFilterEntry[]): ExternalTaskListFilterEntry[];
    }).visibleExternalTaskListEntries([
      externalListEntry(),
      externalListEntry({
        id: "dida:project:work",
        externalListId: "work",
        source: "dida",
        name: "Work",
        color: "#3b82f6"
      })
    ]);

    expect(visibleEntries).toEqual([externalListEntry()]);
  });

  it("resets hidden external list preferences when saved ids no longer exist", () => {
    const plugin = {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined,
        hiddenExternalTaskListFilterIds: ["apple-reminders:list:missing"]
      }
    };
    const view = new TaskHubView({} as never, plugin as never);
    const hiddenIds = (view as unknown as {
      hiddenExternalTaskListFilterIds(entries: readonly ExternalTaskListFilterEntry[]): string[];
    }).hiddenExternalTaskListFilterIds([externalListEntry()]);

    expect(hiddenIds).toEqual([]);
    expect(plugin.settings.hiddenExternalTaskListFilterIds).toEqual([]);
  });

  it("toggles the selected external list filter and persists the lightweight preference", () => {
    const settings: {
      defaultView: "tasks";
      language: "en";
      taskViewFilters: TaskViewFilterSettings;
      lastSessionState?: { selectedExternalListFilterId?: string };
      hiddenExternalTaskListFilterIds?: string[];
    } = {
      defaultView: "tasks",
      language: "en",
      taskViewFilters: fallbackFilters(),
      lastSessionState: undefined,
      hiddenExternalTaskListFilterIds: []
    };
    const saveData = jest.fn(async () => undefined);
    const view = new TaskHubView({} as never, { settings, saveData } as never);
    const render = jest.spyOn(view as unknown as { render(options?: unknown): void }, "render").mockImplementation(() => undefined);
    const entry = externalListEntry();

    (view as unknown as { toggleExternalListFilter(entry: ExternalTaskListFilterEntry): void }).toggleExternalListFilter(entry);

    expect((view as unknown as { selectedExternalListFilterId?: string }).selectedExternalListFilterId).toBe(entry.id);
    expect((settings as { lastSessionState?: { selectedExternalListFilterId?: string } }).lastSessionState?.selectedExternalListFilterId).toBe(entry.id);
    expect(saveData).toHaveBeenCalledWith(settings);
    expect(render).toHaveBeenCalledWith({ preserveTaskListScroll: true, preserveContentScroll: true });
  });
});

describe("TaskHubView external list drag actions", () => {
  function externalListEntry(overrides: Partial<ExternalTaskListFilterEntry> = {}): ExternalTaskListFilterEntry {
    return {
      id: "apple-reminders:list:groceries",
      externalListId: "groceries",
      source: "apple-reminders",
      name: "Groceries",
      color: "#f59e0b",
      itemCount: 1,
      ...overrides
    };
  }

  function pluginForExternalListActions() {
    return {
      settings: {
        defaultView: "tasks",
        language: "en",
        taskViewFilters: fallbackFilters(),
        lastSessionState: undefined
      },
      sendTaskToAppleReminders: jest.fn(async () => undefined),
      sendTaskToDida: jest.fn(async () => undefined),
      moveAppleReminderToList: jest.fn(async () => undefined),
      moveDidaTaskToProject: jest.fn(async () => undefined)
    };
  }

  it("sends vault tasks into the selected Apple Reminders list", async () => {
    const plugin = pluginForExternalListActions();
    const view = new TaskHubView({} as never, plugin as never);
    const draggedTask = task({ id: "vault-1", source: "vault", externalId: undefined, externalListId: undefined });

    await (view as unknown as {
      addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void>;
    }).addTasksToExternalList(externalListEntry(), [draggedTask]);

    expect(plugin.sendTaskToAppleReminders).toHaveBeenCalledWith(draggedTask, {
      type: "apple-reminders",
      listId: "groceries"
    });
  });

  it("sends vault tasks into the selected Dida project", async () => {
    const plugin = pluginForExternalListActions();
    const view = new TaskHubView({} as never, plugin as never);
    const draggedTask = task({ id: "vault-1", source: "vault", externalId: undefined, externalListId: undefined });
    const entry = externalListEntry({
      id: "dida:project:work",
      externalListId: "work",
      source: "dida",
      name: "Work",
      color: "#3b82f6"
    });

    await (view as unknown as {
      addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void>;
    }).addTasksToExternalList(entry, [draggedTask]);

    expect(plugin.sendTaskToDida).toHaveBeenCalledWith(draggedTask, {
      type: "dida",
      projectId: "work"
    });
  });

  it("moves Apple Reminders tasks into another Apple list", async () => {
    const plugin = pluginForExternalListActions();
    const view = new TaskHubView({} as never, plugin as never);
    const draggedTask = task({
      id: "apple-1",
      source: "apple-reminders",
      externalId: "apple-1",
      externalListId: "inbox"
    });

    await (view as unknown as {
      addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void>;
    }).addTasksToExternalList(externalListEntry(), [draggedTask]);

    expect(plugin.moveAppleReminderToList).toHaveBeenCalledWith(draggedTask, "groceries");
  });

  it("moves Dida tasks into another Dida project", async () => {
    const plugin = pluginForExternalListActions();
    const view = new TaskHubView({} as never, plugin as never);
    const draggedTask = task({
      id: "dida-1",
      source: "dida",
      externalId: "dida-1",
      externalListId: "inbox"
    });
    const entry = externalListEntry({
      id: "dida:project:work",
      externalListId: "work",
      source: "dida",
      name: "Work",
      color: "#3b82f6"
    });

    await (view as unknown as {
      addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void>;
    }).addTasksToExternalList(entry, [draggedTask]);

    expect(plugin.moveDidaTaskToProject).toHaveBeenCalledWith(draggedTask, "work");
  });

  it("skips cross-provider drops and same-list no-ops", async () => {
    const plugin = pluginForExternalListActions();
    const view = new TaskHubView({} as never, plugin as never);
    const sameAppleListTask = task({
      id: "apple-1",
      source: "apple-reminders",
      externalId: "apple-1",
      externalListId: "groceries"
    });
    const crossProviderTask = task({
      id: "dida-1",
      source: "dida",
      externalId: "dida-1",
      externalListId: "inbox"
    });

    await (view as unknown as {
      addTasksToExternalList(entry: ExternalTaskListFilterEntry, tasks: TaskItem[]): Promise<void>;
    }).addTasksToExternalList(externalListEntry(), [sameAppleListTask, crossProviderTask]);

    expect(plugin.sendTaskToAppleReminders).not.toHaveBeenCalled();
    expect(plugin.sendTaskToDida).not.toHaveBeenCalled();
    expect(plugin.moveAppleReminderToList).not.toHaveBeenCalled();
    expect(plugin.moveDidaTaskToProject).not.toHaveBeenCalled();
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
    expect(buildTaskViewTransitionKey({ ...base, tags: ["#a", "#b"] }, "smart_focus", "dida:project:today")).not.toBe(normalizedTags);
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
    parentId: overrides.parentId,
    indent: overrides.indent,
    filePath: overrides.filePath ?? "Inbox.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate,
    source: overrides.source ?? "vault",
    externalId: overrides.externalId,
    externalListId: overrides.externalListId
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
