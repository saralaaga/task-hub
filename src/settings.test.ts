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
    expect(settings.calendarCreationDefaultKind).toBe("task");
    expect(settings.calendarTaskCreationDefaultTarget).toEqual({ type: "vault" });
    expect(settings.calendarEventCreationDefaultTarget).toEqual({ type: "apple-calendar" });
    expect(settings.taskCreationFilePath).toBe("Task Hub.md");
    expect(settings.taskNotes).toEqual({
      enabled: false,
      notesFolder: "Task Hub Notes",
      defaultMode: "task-hub",
      thinoIntegrationEnabled: false,
      thinoFolder: "Thino",
      openNoteAfterCreate: true,
      showCountsInTaskList: true
    });
    expect(settings.taskViewFilters).toEqual({ status: "open", tags: [], sourceQuery: "", textQuery: "" });
    expect(settings.ignoredPaths).toEqual(["Archive/"]);
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
      canSendTasksToAppleCalendar: () => true,
      getAppleReminderLists: () => [{ id: "reminders", name: "Reminders" }],
      getAppleCalendars: () => [{ id: "work", name: "Work", writable: true }]
    };

    populateTaskCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([
      { value: "vault", text: "vaultTasks" },
      { value: "apple-reminders:reminders", text: "localAppleReminders: Reminders" }
    ]);
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
