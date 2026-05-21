import TaskHubPlugin from "./main";
import { DEFAULT_SETTINGS } from "./settings";
import type { TaskItem } from "./types";

const notices: string[] = [];
const savedData: unknown[] = [];

jest.mock(
  "obsidian",
  () => ({
    ButtonComponent: class {},
    Editor: class {},
    ItemView: class {},
    MarkdownView: class {},
    Menu: class {},
    Modal: class {},
    Notice: class {
      constructor(message: string) {
        notices.push(message);
      }
    },
    Platform: { isDesktopApp: true },
    PluginSettingTab: class {},
    Plugin: class {
      app: unknown;
      manifest = { id: "task-hub", dir: ".obsidian/plugins/task-hub" };
      async loadData() {
        return null;
      }
      async saveData(data: unknown) {
        savedData.push(data);
      }
      addCommand() {}
      addRibbonIcon() {}
      addSettingTab() {}
      registerEvent() {}
      registerView() {}
    },
    requestUrl: jest.fn(),
    Setting: class {},
    TFile: class {},
    WorkspaceLeaf: class {}
  }),
  { virtual: true }
);

jest.mock("./icons", () => ({
  registerTaskHubIcon: jest.fn(),
  TASK_HUB_ICON_ID: "task-hub"
}));

jest.mock("./localApple", () => ({
  appleCalendarSource: jest.fn(),
  appleRemindersSource: jest.fn(),
  configureLocalAppleHelperPath: jest.fn(),
  createAppleReminder: jest.fn(async () => "reminder-created-1"),
  createAppleCalendarEvent: jest.fn(),
  deleteAppleCalendarEvent: jest.fn(),
  deleteAppleReminder: jest.fn(),
  getLocalAppleHelperStatus: jest.fn(),
  installBundledAppleHelper: jest.fn(),
  readAppleCalendarEventsData: jest.fn(),
  readAppleReminderLists: jest.fn(),
  readAppleRemindersData: jest.fn(),
  requestLocalAppleAccess: jest.fn(),
  setAppleCalendarEventDate: jest.fn(),
  setAppleCalendarEventDetails: jest.fn(),
  setAppleReminderCompleted: jest.fn(),
  setAppleReminderDetails: jest.fn(),
  setAppleReminderDueDate: jest.fn(),
  setAppleReminderList: jest.fn()
}));

const {
  createAppleCalendarEvent,
  createAppleReminder,
  deleteAppleCalendarEvent,
  deleteAppleReminder,
  setAppleCalendarEventDetails,
  setAppleReminderDetails,
  setAppleReminderDueDate
} = jest.requireMock("./localApple");

describe("Apple Reminders migration", () => {
  beforeEach(() => {
    notices.length = 0;
    savedData.length = 0;
    jest.clearAllMocks();
    jest.spyOn(TaskHubPlugin.prototype, "isLocalAppleSupported").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates the Apple Reminder and then removes the source Markdown task", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task());

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Pay invoice",
      notes: expect.stringContaining("Source: Inbox.md:1"),
      dueDate: "2026-05-20",
      listId: undefined
    });
    await expect(process.mock.results[0].value).resolves.toBe("Next");
    expect(Object.values(plugin.settings.appleReminderLinks)).toContain("reminder-created-1");
    expect(notices).toContain("Apple Reminder created and source task removed.");
  });

  it("preserves a timed Markdown task start time when sending it to Apple Reminders", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task({
      rawLine: "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30",
      text: "Pay invoice",
      scheduledDate: "2026-05-20T09:30"
    }));

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Pay invoice",
      notes: expect.stringContaining("Source: Inbox.md:1"),
      dueDate: "2026-05-20",
      startMinutes: 570,
      listId: undefined
    });
  });

  it("reschedules a timed Markdown task in place instead of sending it to Apple Calendar", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.rescheduleTask(task(), {
      dateKey: "2026-05-21",
      startMinutes: 570,
      durationMinutes: 90
    });

    expect(createAppleCalendarEvent).not.toHaveBeenCalled();
    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Pay invoice 📅 2026-05-21 ⏰ 09:30\nNext");
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Apple Calendar event created and source task removed.");
  });

  it("updates an Apple Reminder time when dragged within the same day", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.rescheduleTask(appleReminderTask(), {
      dateKey: "2026-05-20",
      startMinutes: 570
    });

    expect(setAppleReminderDueDate).toHaveBeenCalledWith("reminder-1", "2026-05-20", 570);
    expect(savedData).toHaveLength(0);
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Task is already on this date.");
  });

  it("creates an Apple Calendar event in the selected calendar", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true,
        calendarDefaultTimedTaskDurationMinutes: 75
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate({ dateKey: "2026-05-20", startMinutes: 570 }, "Design review", {
      type: "apple-calendar",
      calendarId: "work"
    });

    expect(createAppleCalendarEvent).toHaveBeenCalledWith({
      title: "Design review",
      date: "2026-05-20",
      startMinutes: 570,
      durationMinutes: 60,
      calendarId: "work"
    });
    expect(notices).toContain("Apple Calendar event created.");
  });

  it("creates an Apple Calendar event with a one-hour default duration", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", {
      type: "apple-calendar",
      calendarId: "work"
    });

    expect(createAppleCalendarEvent).toHaveBeenCalledWith({
      title: "Design review",
      date: "2026-05-20",
      startMinutes: 0,
      durationMinutes: 60,
      calendarId: "work"
    });
  });

  it("deletes a Markdown task from the calendar context action", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        getFileByPath: jest.fn(() => file),
        process
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;

    await plugin.deleteCalendarTask(task());

    await expect(process.mock.results[0].value).resolves.toBe("Next");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("deletes an Apple Reminder only when writeback is enabled", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.deleteCalendarTask(appleReminderTask());

    expect(deleteAppleReminder).toHaveBeenCalledWith("reminder-1");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("deletes an Apple Calendar event only when writeback is enabled", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.deleteCalendarEvent({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Design review",
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false
    });

    expect(deleteAppleCalendarEvent).toHaveBeenCalledWith("event-1");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("updates a Markdown calendar task detail draft in place", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: { getLeavesOfType: jest.fn(() => []) }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskIndex = { reindexFile: jest.fn(async () => undefined) } as never;

    await plugin.updateCalendarTask(task(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      tags: ["#finance"],
      reminderListId: ""
    });

    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Send invoice 📅 2026-05-21 ⏰ 09:30 #finance\nNext");
    expect(notices).toContain("Task updated.");
  });

  it("updates Apple Reminder detail drafts through the helper", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarTask(appleReminderTask(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "list-1",
      notes: "Bring the signed copy"
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith({
      id: "reminder-1",
      title: "Send invoice",
      dueDate: "2026-05-21",
      startMinutes: 570,
      listId: "list-1",
      notes: "Bring the signed copy"
    });
    expect(notices).toContain("Task updated.");
  });

  it("updates Apple Calendar event detail drafts through the helper", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarEvent({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Design review",
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false
    }, {
      kind: "event",
      title: "Updated review",
      date: "2026-05-21",
      startTime: "10:00",
      endTime: "11:15",
      allDay: false,
      calendarId: "calendar-1",
      notes: "Discuss launch scope"
    });

    expect(setAppleCalendarEventDetails).toHaveBeenCalledWith({
      id: "event-1",
      title: "Updated review",
      targetDate: "2026-05-21",
      startMinutes: 600,
      durationMinutes: 75,
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false,
      calendarId: "calendar-1",
      notes: "Discuss launch scope"
    });
    expect(notices).toContain("Event updated.");
  });
});

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "Inbox.md:0:904c04a88c5cf4eec11d8e6c5d80860fd24fca31",
    filePath: "Inbox.md",
    line: 0,
    rawLine: "- [ ] Pay invoice 📅 2026-05-20",
    text: "Pay invoice",
    completed: false,
    tags: [],
    dueDate: "2026-05-20",
    source: "vault",
    ...overrides
  };
}

function appleReminderTask(): TaskItem {
  return {
    id: "apple-reminders:reminder-1",
    externalId: "reminder-1",
    filePath: "Apple Reminders",
    line: 0,
    rawLine: "Pay invoice",
    text: "Pay invoice",
    completed: false,
    tags: [],
    dueDate: "2026-05-20",
    source: "apple-reminders"
  };
}
