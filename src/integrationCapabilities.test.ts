import {
  canCreateAppleRemindersCapability,
  canCreateDidaTasksCapability,
  canDeleteAppleCalendarEventCapability,
  canDeleteAppleReminderCapability
} from "./integrationCapabilities";

describe("integrationCapabilities", () => {
  it("allows Apple Reminders send capability when creation is enabled even if reminders reading is off", () => {
    expect(
      canCreateAppleRemindersCapability(
        {
          enabled: true,
          remindersCreateEnabled: true
        },
        true
      )
    ).toBe(true);
  });

  it("allows Dida send capability when creation is enabled even if Dida tasks reading is off", () => {
    expect(
      canCreateDidaTasksCapability({
        enabled: true,
        tasksCreateEnabled: true,
        apiToken: "token"
      })
    ).toBe(true);
  });

  it("allows Apple Reminder delete capability without writeback editing", () => {
    expect(
      canDeleteAppleReminderCapability(
        {
          enabled: true,
          remindersEnabled: true
        },
        true,
        "reminder-1"
      )
    ).toBe(true);
  });

  it("allows Apple Calendar delete capability without writeback editing when the event is writable", () => {
    expect(
      canDeleteAppleCalendarEventCapability(
        {
          enabled: true,
          calendarEnabled: true
        },
        true,
        true,
        "event-1"
      )
    ).toBe(true);
  });
});
