import {
  TASK_HUB_SETTINGS_SCHEMA_VERSION,
  normalizeTaskHubSettings,
  openTaskHubFeedback,
  parseEventCreationTarget,
  parseTaskCreationTarget,
  populateEventCreationTargetDropdown,
  populateTaskCreationTargetDropdown,
  serializeEventCreationTarget,
  serializeTaskCreationTarget
} from "./settings";

jest.mock(
  "obsidian",
  () => ({
    PluginSettingTab: class {},
    Setting: class {}
  }),
  { virtual: true }
);

describe("normalizeTaskHubSettings", () => {
  it("defaults old settings to calendar task creation enabled with a central task file", () => {
    const settings = normalizeTaskHubSettings({
      ignoredPaths: ["Archive/"]
    });

    expect(settings.calendarTaskCreationEnabled).toBe(true);
    expect(settings.showLunarCalendar).toBe(false);
    expect(settings.showSubtaskProgressBars).toBe(true);
    expect(settings.localApple.calendarTaskSendEnabled).toBe(false);
    expect(settings.localApple.calendarDefaultTimedTaskDurationMinutes).toBe(60);
    expect(settings.localApple.reminderDurationOverrides).toEqual({});
    expect(settings.localApple.reminderColorOverrides).toEqual({});
    expect(settings.localApple.remindersCreateTagsEnabled).toBe(true);
    expect(settings.dida).toMatchObject({
      enabled: false,
      tasksEnabled: false,
      tasksColor: "#3b82f6",
      tasksWritebackEnabled: false,
      tasksCreateEnabled: false,
      tasksDragRescheduleEnabled: false,
      tasksDeleteEnabled: false,
      tasksCreateTagsEnabled: true,
      apiBase: "https://api.dida365.com",
      apiToken: "",
      defaultReminderOffsetMinutes: 0
    });
    expect(settings.dida.taskColorOverrides).toEqual({});
    expect(settings.didaTaskLinks).toEqual({});
    expect(settings.externalTaskSourceOrder).toEqual(["apple-calendar", "apple-reminders", "dida"]);
    expect(settings.calendarCreationDefaultKind).toBe("task");
    expect(settings.calendarTaskCreationDefaultTarget).toEqual({ type: "vault" });
    expect(settings.calendarEventCreationDefaultTarget).toEqual({ type: "apple-calendar" });
    expect(settings.calendarTimeScale).toBe("hour");
    expect(settings.calendarDayStartHour).toBe(6);
    expect(settings.calendarDayEndHour).toBe(22);
    expect(settings.taskCreationFilePath).toBe("Task Hub.md");
    expect(settings.taskNotes).toEqual({
      enabled: false,
      notesFolder: "Task Hub Notes",
      defaultMode: "task-hub",
      thinoIntegrationEnabled: false,
      thinoFolder: "Thino",
      openNoteAfterCreate: true,
      showCountsInTaskList: true,
      showFrontmatterInNoteModal: false,
      linkedNoteSubtasksEnabled: false
    });
    expect(settings.taskViewFilters).toEqual({
      status: "open",
      dateBucket: undefined,
      tags: [],
      conditions: undefined,
      tagQuery: "",
      sourceQuery: "",
      textQuery: ""
    });
    expect(settings.taskListManualOrder).toEqual({});
    expect(settings.taskNoteManualOrder).toEqual({});
    expect(settings.taskNotePinned).toEqual({});
    expect(settings.smartLists).toEqual([]);
    expect(settings.vaultTaskStableState).toEqual({});
    expect(settings.externalTaskLookbackDays).toBe(100);
    expect(settings.externalTaskLookaheadDays).toBe(100);
    expect(settings.externalTaskMetadata).toEqual({});
    expect(settings.ignoredPaths).toEqual(["Archive/"]);
  });

  it("normalizes smart lists with filters and stable task references", () => {
    const settings = normalizeTaskHubSettings({
      smartLists: [
        {
          id: "bad id",
          name: "  ",
          filters: { status: "unknown" },
          taskStableIds: ["vault:th_bad123", "", "vault:th_bad123"],
          taskIds: ["task-a", "", "task-a"],
          createdAt: "not a date",
          updatedAt: "2026-06-30T08:00:00.000Z"
        },
        {
          id: "focus-list",
          name: "Focus",
          color: "#6f94b8",
          filters: {
            status: "all",
            tags: ["#work"],
            tagQuery: "#client",
            sourceQuery: "vault",
            textQuery: "proposal",
            conditions: { operator: "or", tag: "#next", dateBucket: "today", text: "call" }
          },
          taskStableIds: ["vault:th_projects12", "apple-reminders:list:item"],
          taskIds: ["task-1", "task-2"],
          excludedTaskStableIds: ["vault:th_hidden", "", "vault:th_hidden"],
          excludedTaskIds: ["task-hidden", "", "task-hidden"],
          createdAt: "2026-06-29T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z"
        }
      ]
    } as never);

    expect(settings.smartLists).toEqual([
        {
          id: "focus-list",
          name: "Focus",
          color: "#6f94b8",
          filters: {
            status: "all",
            dateBucket: undefined,
          tags: ["#work"],
          tagQuery: "#client",
          sourceQuery: "vault",
          textQuery: "proposal",
          conditions: { operator: "or", tag: "#next", dateBucket: "today", text: "call" }
        },
        taskStableIds: ["vault:th_projects12", "apple-reminders:list:item"],
        taskIds: ["task-1", "task-2"],
        excludedTaskStableIds: ["vault:th_hidden"],
        excludedTaskIds: ["task-hidden"],
        createdAt: "2026-06-29T08:00:00.000Z",
        updatedAt: "2026-06-30T08:00:00.000Z"
      }
    ]);
  });

  it("normalizes external task window and metadata records", () => {
    const settings = normalizeTaskHubSettings({
      externalTaskLookbackDays: 365.9,
      externalTaskLookaheadDays: -10,
      externalTaskMetadata: {
        "apple-reminders:good": {
          startDate: "2026-06-01",
          lastSeenAt: "2026-06-29T10:00:00.000Z"
        },
        "apple-reminders:bad-date": {
          startDate: "06-01-2026",
          lastSeenAt: "not-a-date"
        },
        invalid: {
          startDate: "2026-06-01"
        }
      }
    });

    expect(settings.externalTaskLookbackDays).toBe(365);
    expect(settings.externalTaskLookaheadDays).toBe(0);
    expect(settings.externalTaskMetadata).toEqual({
      "apple-reminders:good": {
        startDate: "2026-06-01",
        lastSeenAt: "2026-06-29T10:00:00.000Z"
      }
    });
  });

  it("normalizes external task source tab order", () => {
    const settings = normalizeTaskHubSettings({
      externalTaskSourceOrder: ["dida", "apple-reminders", "unknown"] as never
    });

    expect(settings.externalTaskSourceOrder).toEqual(["dida", "apple-reminders", "apple-calendar"]);
  });

  it("keeps the default timed task duration within the five-minute minimum", () => {
    expect(normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        calendarDefaultTimedTaskDurationMinutes: 5
      }
    }).localApple.calendarDefaultTimedTaskDurationMinutes).toBe(5);

    expect(normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        calendarDefaultTimedTaskDurationMinutes: 1
      }
    }).localApple.calendarDefaultTimedTaskDurationMinutes).toBe(5);
  });

  it("preserves supported interface languages and falls back from unknown stored values", () => {
    expect(normalizeTaskHubSettings({ language: "ja" }).language).toBe("ja");
    expect(normalizeTaskHubSettings({ language: "fr" }).language).toBe("fr");
    expect(normalizeTaskHubSettings({ language: "ko" }).language).toBe("ko");
    expect(normalizeTaskHubSettings({ language: "de" as never }).language).toBe("en");
  });

  it("migrates cached Dida inbox project names to 收集箱", () => {
    const settings = normalizeTaskHubSettings({
      dida: {
        ...normalizeTaskHubSettings(null).dida,
        projects: [
          { id: "inbox1014354416", name: "未在清单中" },
          { id: "project-1", name: "采购清单" }
        ]
      }
    });

    expect(settings.dida.projects).toEqual([
      { id: "inbox1014354416", name: "收集箱" },
      { id: "project-1", name: "采购清单" }
    ]);
  });

  it("normalizes invalid calendar time scale and visible hour settings", () => {
    const settings = normalizeTaskHubSettings({
      calendarTimeScale: "wide" as never,
      calendarDayStartHour: 25,
      calendarDayEndHour: 4
    });

    expect(settings.calendarTimeScale).toBe("hour");
    expect(settings.calendarDayStartHour).toBe(6);
    expect(settings.calendarDayEndHour).toBe(22);
  });

  it("persists task view filters across settings normalization", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#focus",
        sourceQuery: "apple-reminders",
        textQuery: "invoice",
        conditions: {
          operator: "or",
          tag: "#client",
          dateBucket: "today",
          text: "call"
        }
      }
    });

    expect(settings.taskViewFilters).toEqual({
      status: "all",
      tags: ["#work"],
      tagQuery: "#focus",
      sourceQuery: "apple-reminders",
      textQuery: "invoice",
      conditions: {
        operator: "or",
        tag: "#client",
        dateBucket: "today",
        text: "call"
      }
    });
  });

  it("restores the last Task Hub session state when present", () => {
    const settings = normalizeTaskHubSettings({
      defaultView: "tags",
      taskViewFilters: {
        status: "open",
        tags: [],
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      lastSessionState: {
        view: "calendar",
        taskViewFilters: {
          status: "all",
          tags: ["#work"],
          tagQuery: "#focus",
          sourceQuery: "apple-reminders",
          textQuery: "invoice"
        },
        calendarMode: "week",
        calendarFocusDate: "2026-06-26T10:00:00.000Z",
        visibleSourceIds: ["vault", "apple-reminders"],
        unscheduledPanelOpen: true
      }
    });

    expect(settings.lastSessionState).toEqual({
      view: "calendar",
      taskViewFilters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#focus",
        dateBucket: undefined,
        conditions: undefined,
        sourceQuery: "apple-reminders",
        textQuery: "invoice"
      },
      calendarMode: "week",
      calendarFocusDate: "2026-06-26T10:00:00.000Z",
      visibleSourceIds: ["vault", "apple-reminders"],
      unscheduledPanelOpen: true
    });
  });

  it("falls back to safe defaults for invalid persisted Task Hub session state", () => {
    const settings = normalizeTaskHubSettings({
      defaultView: "tags",
      taskViewFilters: {
        status: "open",
        tags: ["#fallback"],
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      lastSessionState: {
        view: "board" as never,
        taskViewFilters: {
          status: "maybe" as never,
          tags: "#oops" as never,
          sourceQuery: 42 as never,
          textQuery: undefined as never
        },
        calendarMode: "year" as never,
        calendarFocusDate: "not-a-date",
        visibleSourceIds: [],
        unscheduledPanelOpen: "yes" as never
      }
    });

    expect(settings.lastSessionState).toEqual({
      view: "tags",
      taskViewFilters: {
        status: "open",
        dateBucket: undefined,
        tags: [],
        conditions: undefined,
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      calendarMode: "month",
      visibleSourceIds: ["vault"],
      unscheduledPanelOpen: false
    });
  });

  it("keeps explicit subtask progress bar settings while defaulting older settings to enabled", () => {
    expect(normalizeTaskHubSettings({ ignoredPaths: [] }).showSubtaskProgressBars).toBe(true);
    expect(normalizeTaskHubSettings({ showSubtaskProgressBars: false }).showSubtaskProgressBars).toBe(false);
  });

  it("normalizes task manual ordering and vault stable records", () => {
    const settings = normalizeTaskHubSettings({
      taskListManualOrder: {
        "2026-05-08": ["vault:th_a", "vault:th_a", "bad stable id"],
        invalid: ["vault:th_b"]
      },
      taskNoteManualOrder: {
        "task:vault:th_parent": ["note-1", "note-1", "", 42 as never],
        "": ["note-2"],
        "task:vault:th_other": []
      } as never,
      taskNotePinned: {
        "task:vault:th_parent": ["note-2", "note-2", "", 7 as never],
        "": ["note-3"],
        "task:vault:th_empty": []
      } as never,
      vaultTaskStableState: {
        "Project.md": [
          {
            stableId: "vault:th_a",
            currentId: "Project.md:1:abc",
            text: "Task A",
            line: 4.8,
            tags: ["#a", "#a"],
            completed: false
          },
          {
            stableId: "broken",
            currentId: 42,
            text: "Task B",
            line: 1,
            tags: [],
            completed: false
          }
        ]
      } as never
    });

    expect(settings.taskListManualOrder).toEqual({
      "2026-05-08": ["vault:th_a"]
    });
    expect(settings.taskNoteManualOrder).toEqual({
      "task:vault:th_parent": ["note-1"]
    });
    expect(settings.taskNotePinned).toEqual({
      "task:vault:th_parent": ["note-2"]
    });
    expect(settings.vaultTaskStableState).toEqual({
      "Project.md": [
        {
          stableId: "vault:th_a",
          currentId: "Project.md:1:abc",
          text: "Task A",
          line: 4,
          heading: undefined,
          indent: undefined,
          dueDate: undefined,
          scheduledDate: undefined,
          tags: ["#a"],
          completed: false
        }
      ]
    });
  });

  it("migrates the previous completed date bucket to other completed", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "all",
        dateBucket: "completed" as never,
        tags: [],
        sourceQuery: "",
        textQuery: "",
        conditions: {
          operator: "and",
          tag: "",
          dateBucket: "completed" as never,
          text: ""
        }
      }
    });

    expect(settings.taskViewFilters.dateBucket).toBe("otherCompleted");
    expect(settings.taskViewFilters.conditions?.dateBucket).toBe("otherCompleted");
  });

  it("keeps tomorrow as a persisted task date filter", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "open",
        dateBucket: "tomorrow",
        tags: [],
        sourceQuery: "",
        textQuery: ""
      }
    });

    expect(settings.taskViewFilters.dateBucket).toBe("tomorrow");
  });

  it("persists quick tag query filters across settings normalization", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "open",
        tags: [],
        tagQuery: "#focus",
        sourceQuery: "",
        textQuery: ""
      }
    });

    expect(settings.taskViewFilters.tagQuery).toBe("#focus");
  });

  it("migrates the old Apple Reminder tag creation default to enabled", () => {
    const settings = normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        remindersCreateTagsEnabled: false
      }
    });

    expect(settings.localApple.remindersCreateTagsEnabled).toBe(true);
  });

  it("preserves Apple Reminder tag creation when explicitly disabled after the migration", () => {
    const settings = normalizeTaskHubSettings({
      settingsSchemaVersion: TASK_HUB_SETTINGS_SCHEMA_VERSION,
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        remindersCreateTagsEnabled: false
      }
    });

    expect(settings.localApple.remindersCreateTagsEnabled).toBe(false);
  });

  it("keeps Apple Calendar task sending behind its own explicit setting", () => {
    const settings = normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: true,
        calendarTaskSendEnabled: true
      }
    });

    expect(settings.localApple.calendarWritebackEnabled).toBe(true);
    expect(settings.localApple.calendarTaskSendEnabled).toBe(true);
  });

  it("round-trips Apple Reminders calendar task creation targets", () => {
    const target = parseTaskCreationTarget("apple-reminders:list-1");

    expect(target).toEqual({ type: "apple-reminders", listId: "list-1" });
    expect(serializeTaskCreationTarget(target)).toBe("apple-reminders:list-1");
  });

  it("round-trips Dida calendar task creation targets", () => {
    const target = parseTaskCreationTarget("dida:project-1");

    expect(target).toEqual({ type: "dida", projectId: "project-1" });
    expect(serializeTaskCreationTarget(target)).toBe("dida:project-1");
  });

  it("round-trips Apple Calendar event creation targets", () => {
    const target = parseEventCreationTarget("apple-calendar:work");

    expect(target).toEqual({ type: "apple-calendar", calendarId: "work" });
    expect(serializeEventCreationTarget(target)).toBe("apple-calendar:work");
  });

  it("keeps Apple Calendar calendars out of task creation targets", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => true,
      canCreateDidaTasks: () => true,
      canSendTasksToAppleCalendar: () => true,
      getAppleReminderLists: () => [{ id: "reminders", name: "Reminders" }],
      getDidaProjects: () => [{ id: "dida-project", name: "Task Hub Test" }],
      getAppleCalendars: () => [{ id: "work", name: "Work", writable: true }]
    };

    populateTaskCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([
      { value: "vault", text: "vaultTasks" },
      { value: "apple-reminders:reminders", text: "localAppleReminders: Reminders" },
      { value: "dida:dida-project", text: "dida: Task Hub Test" }
    ]);
  });

  it("does not add a synthetic Dida inbox task target when no projects are loaded", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => false,
      canCreateDidaTasks: () => true,
      getAppleReminderLists: () => [],
      getDidaProjects: () => []
    };

    populateTaskCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([{ value: "vault", text: "vaultTasks" }]);
  });

  it("adds only writable Apple Calendar calendars to the event creation target dropdown", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => false,
      canSendTasksToAppleCalendar: () => true,
      getAppleCalendars: () => [
        { id: "work", name: "Work", writable: true },
        { id: "birthdays", name: "Birthdays", writable: false },
        { id: "cn-holidays", name: "中国大陆节假日", writable: false }
      ]
    };

    populateEventCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([
      { value: "apple-calendar:work", text: "localAppleCalendar: Work" }
    ]);
  });

  it("opens the Task Hub feedback issue page", () => {
    const openUrl = jest.fn();

    openTaskHubFeedback(openUrl);

    expect(openUrl).toHaveBeenCalledWith("https://github.com/saralaaga/task-hub/issues/new");
  });
});
