import {
  calendarRecordToEvent,
  appleCalendarsFromEvents,
  installBundledAppleHelper,
  normalizeAppleHelperError,
  normalizeAppleScriptError,
  createAppleReminder,
  createAppleCalendarEvent,
  deleteAppleCalendarEvent,
  deleteAppleReminder,
  readAppleCalendarLists,
  readAppleReminderLists,
  reminderToTask,
  setAppleCalendarEventDate,
  setAppleCalendarEventDetails,
  setAppleReminderCompleted,
  setAppleReminderDetails,
  setAppleReminderDueDate,
  setAppleReminderList
} from "./localApple";

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn(actual.existsSync),
    readFileSync: jest.fn(actual.readFileSync),
    chmodSync: jest.fn(actual.chmodSync),
    mkdirSync: jest.fn(actual.mkdirSync),
    writeFileSync: jest.fn(actual.writeFileSync)
  };
});

jest.mock("child_process", () => ({
  execFile: jest.fn((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => callback(null, "{\"ok\":true}", ""))
}));

const { execFile } = jest.requireMock("child_process");
const { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } = jest.requireMock("fs");

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

Object.assign(globalThis, {
  TASKHUB_APPLE_HELPER_BASE64: "dGFza2h1Yi10ZXN0LWhlbHBlcg==",
  TASKHUB_APPLE_HELPER_SHA256: "98250e512d4e032c450f39e79bd8d8cefad6dfab6eb9ab024b172cc6643e3a6e"
});

describe("local Apple mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps Apple Reminders records to read-only Task Hub tasks", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          listId: "list-1",
          list: "Personal",
          completed: false,
          dueDate: "2026-05-06T12:00:00.000Z",
          notes: "Use the shared list",
          url: "x-apple-reminderkit://reminder/reminder-1"
        },
        0
      )
    ).toMatchObject({
      id: "apple-reminders:reminder-1",
      text: "Buy milk",
      filePath: "Apple Reminders/Personal",
      dueDate: "2026-05-06",
      source: "apple-reminders",
      externalSourceName: "Personal",
      externalListId: "list-1",
      externalUrl: "x-apple-reminderkit://reminder/reminder-1"
    });
  });

  it("extracts Apple Reminder hashtags as Task Hub tags and removes them from the display title", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk #errand #client-acme",
          list: "Personal",
          completed: false
        },
        0
      )
    ).toMatchObject({
      text: "Buy milk",
      tags: ["#errand", "#client-acme"],
      source: "apple-reminders"
    });
  });

  it("merges Apple Reminder helper tags with title hashtags", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk #errand",
          list: "Personal",
          completed: false,
          tags: ["client-acme", "#errand"]
        },
        0
      )
    ).toMatchObject({
      text: "Buy milk",
      tags: ["#errand", "#client-acme"],
      source: "apple-reminders"
    });
  });

  it("preserves Apple Reminder due times for calendar placement", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          list: "Personal",
          completed: false,
          dueDate: "2026-05-20T09:30:00",
          alertMinutesBefore: 15
        },
        0
      )
    ).toMatchObject({
      dueDate: "2026-05-20",
      scheduledDate: "2026-05-20T09:30",
      alertMinutesBefore: 15
    });
  });

  it("preserves Apple Reminder local due date keys without UTC shifting", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          list: "Personal",
          completed: false,
          dueDate: "2026-05-20"
        },
        0
      )
    ).toMatchObject({
      dueDate: "2026-05-20",
      scheduledDate: "2026-05-20"
    });
  });

  it("maps Apple Reminder completion dates into Task Hub completedDate", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          list: "Personal",
          completed: true,
          completionDate: "2026-05-21T08:15:00.000Z"
        },
        0
      )
    ).toMatchObject({
      completed: true,
      completedDate: "2026-05-21"
    });
  });

  it("preserves Apple Reminder zoned midnight due date keys without UTC shifting", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          list: "Personal",
          completed: false,
          dueDate: "2026-05-19T16:00:00.000Z"
        },
        0
      )
    ).toMatchObject({
      dueDate: "2026-05-20",
      scheduledDate: "2026-05-20T00:00"
    });
  });

  it("maps Apple Calendar records to Task Hub calendar events", () => {
    expect(
      calendarRecordToEvent(
        {
          id: "event-1",
          title: "Planning",
          calendarId: "calendar-1",
          calendar: "Work",
          calendarColor: "#FF9500",
          startDate: "2026-05-06T09:30:00.000Z",
          endDate: "2026-05-06T10:00:00.000Z",
          allDay: false,
          location: "Office",
          notes: "Bring agenda"
        },
        0
      )
    ).toMatchObject({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Planning",
      start: "2026-05-06T09:30:00.000Z",
      end: "2026-05-06T10:00:00.000Z",
      allDay: false,
      calendarId: "calendar-1",
      calendarName: "Work",
      calendarColor: "#FF9500",
      location: "Office",
      description: "Bring agenda"
    });
  });

  it("maps Apple recurrence fields to Task Hub items", () => {
    expect(
      reminderToTask(
        {
          id: "reminder-1",
          name: "Buy milk",
          list: "Personal",
          completed: false,
          recurrence: "RRULE:FREQ=WEEKLY"
        },
        0
      )
    ).toMatchObject({ recurrence: "RRULE:FREQ=WEEKLY" });

    expect(
      calendarRecordToEvent(
        {
          id: "event-1",
          title: "Planning",
          startDate: "2026-05-06T09:30:00.000Z",
          allDay: false,
          recurrence: "RRULE:FREQ=MONTHLY"
        },
        0
      )
    ).toMatchObject({ recurrence: "RRULE:FREQ=MONTHLY" });
  });

  it("collects Apple calendars from event metadata", () => {
    expect(
      appleCalendarsFromEvents([
        {
          id: "event-1",
          sourceId: "apple-calendar",
          title: "Planning",
          start: "2026-05-06T09:30:00.000Z",
          allDay: false,
          calendarId: "work",
          calendarName: "Work",
          calendarColor: "#FF9500"
        },
        {
          id: "event-2",
          sourceId: "apple-calendar",
          title: "Class",
          start: "2026-05-06T10:30:00.000Z",
          allDay: false,
          calendarId: "class",
          calendarName: "Class",
          calendarColor: "#34C759"
        },
        {
          id: "event-3",
          sourceId: "apple-calendar",
          title: "Standup",
          start: "2026-05-07T09:30:00.000Z",
          allDay: false,
          calendarId: "work",
          calendarName: "Work"
        }
      ])
    ).toEqual([
      { id: "class", name: "Class", color: "#34C759" },
      { id: "work", name: "Work", color: "#FF9500" }
    ]);
  });

  it("maps AppleScript application lookup failures to a local Apple action hint", () => {
    expect(normalizeAppleScriptError(new Error("execution error: Error: Application can't be found. (-2700)")).message).toContain(
      "Local Apple app could not be found"
    );
  });

  it("maps AppleScript timeouts to a local Apple automation hint", () => {
    expect(normalizeAppleScriptError(new Error("execution error: AppleEvent timed out. (-1712)")).message).toContain(
      "Local Apple automation timed out"
    );
  });

  it("maps process timeouts to a local Apple automation hint", () => {
    expect(normalizeAppleScriptError({ killed: true }).message).toContain("Local Apple automation timed out");
  });

  it("maps missing helper errors to an install hint", () => {
    const error = normalizeAppleHelperError({ code: "ENOENT" }) as Error & { code?: string };

    expect(error.message).toContain("Apple helper is missing");
    expect(error.code).toBe("missing_helper");
  });

  it("maps helper timeouts to a retry hint", () => {
    const error = normalizeAppleHelperError({ killed: true }) as Error & { code?: string };

    expect(error.message).toContain("Local Apple helper timed out");
    expect(error.code).toBe("timeout");
  });

  it("maps helper stderr JSON to a permission hint", () => {
    const error = normalizeAppleHelperError({
      stderr: "{\"ok\":false,\"code\":\"permission_denied\",\"message\":\"Calendar access was denied.\"}"
    }) as Error & { code?: string };

    expect(error.message).toBe("Calendar access was denied.");
    expect(error.code).toBe("permission_denied");
  });

  it("writes Apple Reminder completion through the helper", async () => {
    await withPlatform("darwin", () => setAppleReminderCompleted("reminder-1", true));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["set-reminder-completed", "--id", "reminder-1", "--completed", "true"]);
  });

  it("writes Apple Reminder due dates through the helper", async () => {
    await withPlatform("darwin", () => setAppleReminderDueDate("reminder-1", "2026-05-20"));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["set-reminder-due", "--id", "reminder-1", "--due", "2026-05-20"]);
  });

  it("writes Apple Reminder due times through the helper", async () => {
    await withPlatform("darwin", () => setAppleReminderDueDate("reminder-1", "2026-05-20", 570));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-reminder-due",
      "--id",
      "reminder-1",
      "--due",
      "2026-05-20",
      "--start-minutes",
      "570"
    ]);
  });

  it("writes Apple Reminder detail fields through the helper", async () => {
    await withPlatform("darwin", () =>
      setAppleReminderDetails({
        id: "reminder-1",
        title: "Send invoice",
        dueDate: "2026-05-20",
        startMinutes: 570,
        alertMinutesBefore: 10,
        listId: "list-1",
        notes: "Bring the signed copy",
        tags: ["#finance", "#client/acme"]
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-reminder-details",
      "--id",
      "reminder-1",
      "--title",
      "Send invoice #finance #client-acme",
      "--due",
      "2026-05-20",
      "--start-minutes",
      "570",
      "--alert-minutes-before",
      "10",
      "--list-id",
      "list-1",
      "--notes",
      "Bring the signed copy",
      "--tag",
      "#finance",
      "--tag",
      "#client-acme"
    ]);
  });

  it("writes Apple Reminder recurrence through the detail helper", async () => {
    await withPlatform("darwin", () =>
      setAppleReminderDetails({
        id: "reminder-1",
        title: "Send invoice",
        recurrence: "RRULE:FREQ=WEEKLY"
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-reminder-details",
      "--id",
      "reminder-1",
      "--title",
      "Send invoice",
      "--recurrence",
      "RRULE:FREQ=WEEKLY"
    ]);
  });

  it("clears Apple Reminder recurrence through the detail helper", async () => {
    await withPlatform("darwin", () =>
      setAppleReminderDetails({
        id: "reminder-1",
        title: "Send invoice",
        recurrence: null
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-reminder-details",
      "--id",
      "reminder-1",
      "--title",
      "Send invoice",
      "--clear-recurrence"
    ]);
  });

  it("can clear Apple Reminder due fields through the detail helper", async () => {
    await withPlatform("darwin", () =>
      setAppleReminderDetails({
        id: "reminder-1",
        title: "Send invoice",
        dueDate: null,
        alertMinutesBefore: null
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-reminder-details",
      "--id",
      "reminder-1",
      "--title",
      "Send invoice",
      "--clear-due",
      "--clear-alert"
    ]);
  });

  it("writes Apple Calendar event dates through the helper", async () => {
    await withPlatform("darwin", () =>
      setAppleCalendarEventDate({
        id: "event-1",
        targetDate: "2026-05-20",
        start: "2026-05-06T09:30:00.000Z",
        end: "2026-05-06T10:30:00.000Z",
        allDay: false
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-calendar-event-date",
      "--id",
      "event-1",
      "--date",
      "2026-05-20",
      "--start",
      "2026-05-06T09:30:00.000Z",
      "--end",
      "2026-05-06T10:30:00.000Z",
      "--all-day",
      "false"
    ]);
  });

  it("writes Apple Calendar event times through the helper", async () => {
    await withPlatform("darwin", () =>
      setAppleCalendarEventDate({
        id: "event-1",
        targetDate: "2026-05-20",
        startMinutes: 570,
        durationMinutes: 90,
        start: "2026-05-06T09:30:00.000Z",
        end: "2026-05-06T10:30:00.000Z",
        allDay: false
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-calendar-event-date",
      "--id",
      "event-1",
      "--date",
      "2026-05-20",
      "--start",
      "2026-05-06T09:30:00.000Z",
      "--end",
      "2026-05-06T10:30:00.000Z",
      "--start-minutes",
      "570",
      "--duration-minutes",
      "90",
      "--all-day",
      "false"
    ]);
  });

  it("writes Apple Calendar event detail fields through the helper", async () => {
    await withPlatform("darwin", () =>
      setAppleCalendarEventDetails({
        id: "event-1",
        title: "Design review",
        targetDate: "2026-05-20",
        startMinutes: 570,
        durationMinutes: 45,
        start: "2026-05-06T09:30:00.000Z",
        end: "2026-05-06T10:30:00.000Z",
        allDay: false,
        calendarId: "calendar-1",
        notes: "Discuss launch scope",
        location: "Room 516"
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-calendar-event-details",
      "--id",
      "event-1",
      "--title",
      "Design review",
      "--date",
      "2026-05-20",
      "--start",
      "2026-05-06T09:30:00.000Z",
      "--end",
      "2026-05-06T10:30:00.000Z",
      "--start-minutes",
      "570",
      "--duration-minutes",
      "45",
      "--calendar-id",
      "calendar-1",
      "--notes",
      "Discuss launch scope",
      "--location",
      "Room 516",
      "--all-day",
      "false"
    ]);
  });

  it("writes Apple Calendar recurrence and future span through the helper", async () => {
    await withPlatform("darwin", () =>
      setAppleCalendarEventDetails({
        id: "event-1",
        title: "Design review",
        targetDate: "2026-05-20",
        start: "2026-05-06T09:30:00.000Z",
        allDay: true,
        recurrence: "RRULE:FREQ=MONTHLY",
        recurrenceScope: "future"
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "set-calendar-event-details",
      "--id",
      "event-1",
      "--title",
      "Design review",
      "--date",
      "2026-05-20",
      "--start",
      "2026-05-06T09:30:00.000Z",
      "--recurrence",
      "RRULE:FREQ=MONTHLY",
      "--span",
      "future",
      "--all-day",
      "true"
    ]);
  });

  it("creates an Apple Calendar event through the helper", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true}", "");
    });

    await withPlatform("darwin", () =>
      createAppleCalendarEvent({
        title: "Pay invoice",
        date: "2026-05-20",
        notes: "From Task Hub\nFinance.md:3",
        durationMinutes: 1440
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "create-calendar-event",
      "--title",
      "Pay invoice",
      "--date",
      "2026-05-20",
      "--notes",
      "From Task Hub\nFinance.md:3",
      "--duration-minutes",
      "1440"
    ]);
  });

  it("creates a timed Apple Calendar event through the helper", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true}", "");
    });

    await withPlatform("darwin", () =>
      createAppleCalendarEvent({
        title: "Pay invoice",
        date: "2026-05-20",
        notes: "From Task Hub\nFinance.md:3",
        startMinutes: 570,
        durationMinutes: 90,
        calendarId: "calendar-1"
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "create-calendar-event",
      "--title",
      "Pay invoice",
      "--date",
      "2026-05-20",
      "--notes",
      "From Task Hub\nFinance.md:3",
      "--start-minutes",
      "570",
      "--duration-minutes",
      "90",
      "--calendar-id",
      "calendar-1"
    ]);
  });

  it("creates recurring Apple Calendar events through the helper", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true}", "");
    });

    await withPlatform("darwin", () =>
      createAppleCalendarEvent({
        title: "Pay invoice",
        date: "2026-05-20",
        recurrence: "RRULE:FREQ=WEEKLY"
      })
    );

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "create-calendar-event",
      "--title",
      "Pay invoice",
      "--date",
      "2026-05-20",
      "--recurrence",
      "RRULE:FREQ=WEEKLY"
    ]);
  });

  it("deletes Apple Reminders through the helper", async () => {
    await withPlatform("darwin", () => deleteAppleReminder("reminder-1"));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["delete-reminder", "--id", "reminder-1"]);
  });

  it("deletes Apple Calendar events through the helper", async () => {
    await withPlatform("darwin", () => deleteAppleCalendarEvent("event-1"));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["delete-calendar-event", "--id", "event-1"]);
  });

  it("creates an Apple Reminder through the helper with task metadata", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true,\"reminderId\":\"created-reminder-1\"}", "");
    });

    const id = await withPlatform("darwin", () =>
      createAppleReminder({
        title: "Send proposal",
        notes: "From Task Hub\nProjects/Acme.md:3",
        dueDate: "2026-05-20",
        startMinutes: 570,
        alertMinutesBefore: 30,
        listId: "list-1",
        tags: ["#work", "#client/acme"],
        recurrence: "RRULE:FREQ=DAILY"
      })
    );

    expect(id).toBe("created-reminder-1");
    expect(execFile.mock.calls.at(-1)?.[1]).toEqual([
      "create-reminder",
      "--title",
      "Send proposal #work #client-acme",
      "--notes",
      "From Task Hub\nProjects/Acme.md:3",
      "--due",
      "2026-05-20",
      "--start-minutes",
      "570",
      "--alert-minutes-before",
      "30",
      "--list-id",
      "list-1",
      "--recurrence",
      "RRULE:FREQ=DAILY",
      "--tag",
      "#work",
      "--tag",
      "#client-acme"
    ]);
  });

  it("reads Apple Reminder lists through the helper", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true,\"lists\":[{\"id\":\"list-1\",\"name\":\"Personal\",\"sourceId\":\"source-1\",\"sourceName\":\"iCloud\"}]}", "");
    });

    await expect(withPlatform("darwin", () => readAppleReminderLists())).resolves.toEqual([
      { id: "list-1", name: "Personal", sourceId: "source-1", sourceName: "iCloud" }
    ]);
    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["reminder-lists"]);
  });

  it("reads Apple Calendar lists through the helper", async () => {
    execFile.mockImplementationOnce((_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(null, "{\"ok\":true,\"calendars\":[{\"id\":\"calendar-1\",\"name\":\"Work\",\"color\":\"#FF9500\",\"writable\":true}]}", "");
    });

    await expect(withPlatform("darwin", () => readAppleCalendarLists())).resolves.toEqual([
      { id: "calendar-1", name: "Work", color: "#FF9500", writable: true }
    ]);
    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["calendar-lists"]);
  });

  it("moves Apple Reminders to another list through the helper", async () => {
    await withPlatform("darwin", () => setAppleReminderList("reminder-1", "list-1"));

    expect(execFile.mock.calls.at(-1)?.[1]).toEqual(["set-reminder-list", "--id", "reminder-1", "--list-id", "list-1"]);
  });

  it("installs the bundled helper payload when the plugin directory is missing the helper", () => {
    const helperPath = "/private/tmp/taskhub-apple-helper-test";
    existsSync.mockReturnValueOnce(false);
    writeFileSync.mockImplementationOnce(() => undefined);
    chmodSync.mockImplementationOnce(() => undefined);
    mkdirSync.mockImplementationOnce(() => undefined);

    expect(installBundledAppleHelper(helperPath, "darwin")).toBe(true);
    expect(mkdirSync).toHaveBeenCalledWith("/private/tmp", { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(helperPath, expect.any(Buffer), { mode: 0o755 });
    expect(chmodSync).toHaveBeenCalledWith(helperPath, 0o755);
    expect(readFileSync).not.toHaveBeenCalledWith(helperPath);
  });
});

async function withPlatform<T>(platform: NodeJS.Platform, run: () => T | Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform });
  try {
    return await run();
  } finally {
    if (descriptor) {
      Object.defineProperty(process, "platform", descriptor);
    }
  }
}
