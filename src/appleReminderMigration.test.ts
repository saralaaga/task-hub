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
  requestLocalAppleAccess,
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

  it("keeps the source Markdown task and shows a permission action when Reminders access is still pending", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    createAppleReminder.mockRejectedValueOnce(notDetermined);
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "notDetermined" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext")
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

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(createAppleReminder).toHaveBeenCalledTimes(1);
    expect(process).not.toHaveBeenCalled();
    expect(Object.values(plugin.settings.appleReminderLinks)).not.toContain("reminder-created-1");
    expect(notices).toContain(
      "Apple Reminders permission is still pending. Open Task Hub settings > Local Apple, click Request access, then approve Reminders permission in macOS."
    );
  });

  it("adds source task tags to Apple Reminder titles by default", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice #work #client/acme 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice #work #client/acme 📅 2026-05-20\nNext"),
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
      rawLine: "- [ ] Pay invoice #work #client/acme 📅 2026-05-20",
      text: "Pay invoice",
      tags: ["#work", "#client/acme"]
    }));

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pay invoice #work #client-acme"
    }));
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

  it("removes a timed Markdown task start time when dragged to the all-day area on the same date", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
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

    await plugin.rescheduleTask(task({
      rawLine: "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30",
      scheduledDate: "2026-05-20T09:30"
    }), "2026-05-20");

    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Pay invoice 📅 2026-05-20\nNext");
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Task is already on this date.");
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

  it("removes an Apple Reminder start time when dragged to the all-day area on the same date", async () => {
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

    await plugin.rescheduleTask({
      ...appleReminderTask(),
      scheduledDate: "2026-05-20T09:30"
    }, "2026-05-20");

    expect(setAppleReminderDueDate).toHaveBeenCalledWith("reminder-1", "2026-05-20", undefined);
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
    }, "Bring prototype notes");

    expect(createAppleCalendarEvent).toHaveBeenCalledWith({
      title: "Design review",
      date: "2026-05-20",
      startMinutes: 570,
      durationMinutes: 60,
      calendarId: "work",
      notes: "Bring prototype notes"
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

  it("creates an Apple Reminder with modal notes", async () => {
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
        remindersCreateEnabled: true,
        remindersDefaultListId: "default-list"
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", {
      type: "apple-reminders",
      listId: "list-1"
    }, "Bring prototype notes");

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Design review",
      dueDate: "2026-05-20",
      startMinutes: undefined,
      listId: "list-1",
      notes: "Bring prototype notes"
    });
    expect(notices).toContain("Apple Reminder created.: reminder-created-1");
  });

  it("requests Reminders access and retries when creating an Apple Reminder before permission is granted", async () => {
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    createAppleReminder.mockRejectedValueOnce(notDetermined).mockResolvedValueOnce("reminder-created-after-access");
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "fullAccess" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-reminders" });

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(createAppleReminder).toHaveBeenCalledTimes(2);
    expect(notices).toContain("Apple Reminder created.: reminder-created-after-access");
  });

  it("shows an Obsidian permission reminder when Apple Reminders write access is denied", async () => {
    const denied = Object.assign(new Error("Apple access was denied in macOS Privacy & Security settings."), {
      code: "permission_denied"
    });
    createAppleReminder.mockRejectedValueOnce(denied);
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-reminders" });

    expect(notices).toContain(
      "Apple Reminders permission is blocked. Open macOS System Settings > Privacy & Security > Reminders, allow Obsidian or Task Hub Apple Helper, then try again."
    );
  });

  it("shows an Obsidian permission reminder when Apple Calendar write access is denied", async () => {
    const denied = Object.assign(new Error("Apple access was denied in macOS Privacy & Security settings."), {
      code: "permission_denied"
    });
    createAppleCalendarEvent.mockRejectedValueOnce(denied);
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
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

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-calendar" });

    expect(notices).toContain(
      "Apple Calendar permission is blocked. Open macOS System Settings > Privacy & Security > Calendars, allow Obsidian or Task Hub Apple Helper, then try again."
    );
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

  it("preserves Apple Reminder title hashtags when updating other details", async () => {
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

    await plugin.updateCalendarTask(appleReminderTask({ tags: ["#errand", "#client-acme"] }), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "list-1",
      notes: "Bring the signed copy"
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith(expect.objectContaining({
      title: "Send invoice #errand #client-acme"
    }));
  });

  it("updates Apple Reminder title hashtags from edited task tags", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
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

    await plugin.updateCalendarTask(appleReminderTask({ tags: ["#old"] }), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      tags: ["#errand", "#client-acme"]
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith(expect.objectContaining({
      title: "Send invoice #errand #client-acme"
    }));
  });

  it("requests Reminders access and retries when updating before permission is granted", async () => {
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    setAppleReminderDetails.mockRejectedValueOnce(notDetermined).mockResolvedValueOnce(undefined);
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "fullAccess" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
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

    await plugin.updateCalendarTask(appleReminderTask(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "",
      notes: "Bring the signed copy"
    });

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(setAppleReminderDetails).toHaveBeenCalledTimes(2);
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

function appleReminderTask(overrides: Partial<TaskItem> = {}): TaskItem {
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
    source: "apple-reminders",
    ...overrides
  };
}
