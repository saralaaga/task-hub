import {
  normalizeTaskHubSettings,
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
    expect(settings.calendarCreationDefaultKind).toBe("task");
    expect(settings.calendarTaskCreationDefaultTarget).toEqual({ type: "vault" });
    expect(settings.calendarEventCreationDefaultTarget).toEqual({ type: "apple-calendar" });
    expect(settings.taskCreationFilePath).toBe("Task Hub.md");
    expect(settings.ignoredPaths).toEqual(["Archive/"]);
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
});
