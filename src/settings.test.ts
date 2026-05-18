import { normalizeTaskHubSettings, parseTaskCreationTarget, serializeTaskCreationTarget } from "./settings";

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
    expect(settings.calendarTaskCreationDefaultTarget).toEqual({ type: "vault" });
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
});
