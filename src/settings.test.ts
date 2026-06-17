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
      showFrontmatterInNoteModal: false
    });
    expect(settings.taskViewFilters).toEqual({ status: "open", tags: [], sourceQuery: "", textQuery: "" });
    expect(settings.ignoredPaths).toEqual(["Archive/"]);
  });

  it("normalizes external task source tab order", () => {
    const settings = normalizeTaskHubSettings({
      externalTaskSourceOrder: ["dida", "apple-reminders", "unknown"] as never
    });

    expect(settings.externalTaskSourceOrder).toEqual(["dida", "apple-reminders", "apple-calendar"]);
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
