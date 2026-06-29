import { buildCalendarItems, getCalendarRange } from "./calendarModel";
import type { CalendarEvent, TaskItem } from "../types";

const TASKS: TaskItem[] = [
  task({ id: "task-1", text: "Due today", startDate: "2026-05-06" }),
  task({ id: "task-2", text: "Done today", completed: true, startDate: "2026-05-06" }),
  task({ id: "task-3", text: "No date" })
];

const EVENTS: CalendarEvent[] = [
  {
    id: "event-1",
    sourceId: "holidays",
    title: "Holiday",
    start: "2026-05-06",
    allDay: true
  }
];

const TIMED_EVENTS: CalendarEvent[] = [
  {
    id: "event-2",
    sourceId: "work",
    title: "Design review",
    start: "2026-05-06T09:30:00",
    end: "2026-05-06T10:45:00",
    allDay: false
  }
];

describe("buildCalendarItems", () => {
  it("converts dated open tasks to all-day calendar items", () => {
    const items = buildCalendarItems({
      tasks: TASKS,
      events: [],
      visibleSourceIds: new Set(["vault"]),
      includeCompletedTasks: false
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: "task:task-1",
        title: "Due today",
        date: "2026-05-06",
        kind: "task",
        allDay: true
      })
    ]);
  });

  it("uses scheduled date first and falls back to start date for vault tasks", () => {
    const items = buildCalendarItems({
      tasks: [
        task({ id: "scheduled", text: "Scheduled", startDate: "2026-05-06", scheduledDate: "2026-05-08" }),
        task({ id: "started", text: "Started", startDate: "2026-05-07" })
      ],
      events: [],
      visibleSourceIds: new Set(["vault"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => `${item.id}:${item.date}`)).toEqual(["task:started:2026-05-07", "task:scheduled:2026-05-08"]);
  });

  it("honors completed-task and source layer visibility", () => {
    const items = buildCalendarItems({
      tasks: TASKS,
      events: EVENTS,
      visibleSourceIds: new Set(["vault", "holidays"]),
      includeCompletedTasks: true
    });

    expect(new Set(items.map((item) => item.id))).toEqual(
      new Set(["event:holidays:event-1", "task:task-1", "task:task-2"])
    );
  });

  it("orders completed all-day tasks below open all-day tasks on the same date", () => {
    const items = buildCalendarItems({
      tasks: [
        task({ id: "done", text: "A done task", completed: true, dueDate: "2026-05-06" }),
        task({ id: "open", text: "Z open task", dueDate: "2026-05-06" })
      ],
      events: [],
      visibleSourceIds: new Set(["vault"]),
      includeCompletedTasks: true
    });

    expect(items.map((item) => item.id)).toEqual(["task:open", "task:done"]);
  });

  it("keeps Apple Reminder tasks with due times as time-point items", () => {
    const items = buildCalendarItems({
      tasks: [
        task({
          id: "reminder",
          text: "Timed reminder",
          dueDate: "2026-05-06",
          source: "apple-reminders",
          scheduledDate: "2026-05-06T09:30:00"
        })
      ],
      events: [],
      visibleSourceIds: new Set(["apple-reminders"]),
      includeCompletedTasks: false
    });

    expect(items[0]).toMatchObject({
      date: "2026-05-06",
      allDay: false,
      startMinutes: 570,
      endMinutes: undefined
    });
  });

  it("uses Apple Reminder list colors before the global Reminders source color", () => {
    const items = buildCalendarItems({
      tasks: [
        task({
          id: "reminder",
          text: "List-colored reminder",
          dueDate: "2026-05-06",
          source: "apple-reminders",
          externalListId: "personal"
        })
      ],
      events: [],
      visibleSourceIds: new Set(["apple-reminders"]),
      includeCompletedTasks: false,
      sourceColors: { "apple-reminders": "#f59e0b" },
      taskColors: { personal: "#22c55e" }
    });

    expect(items[0]).toMatchObject({ color: "#22c55e" });
  });

  it("does not assign real durations to timed reminders", () => {
    const items = buildCalendarItems({
      tasks: [
        task({
          id: "reminder",
          externalId: "reminder-1",
          text: "Timed reminder",
          dueDate: "2026-05-06",
          source: "apple-reminders",
          scheduledDate: "2026-05-06T09:30:00"
        })
      ],
      events: [],
      visibleSourceIds: new Set(["apple-reminders"]),
      includeCompletedTasks: false,
      taskDurationOverrides: {
        "reminder-1": 90
      }
    });

    expect(items[0]).toMatchObject({
      startMinutes: 570,
      endMinutes: undefined
    });
  });

  it("sorts tasks with the same time by creation date descending", () => {
    const items = buildCalendarItems({
      tasks: [
        task({ id: "older", text: "Older", dueDate: "2026-05-06", scheduledDate: "2026-05-06T09:30", createdDate: "2026-05-01T09:00:00" }),
        task({ id: "newer", text: "Newer", dueDate: "2026-05-06", scheduledDate: "2026-05-06T09:30", createdDate: "2026-05-02T09:00:00" })
      ],
      events: [],
      visibleSourceIds: new Set(["vault"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.id)).toEqual(["task:newer", "task:older"]);
  });

  it("filters hidden external sources", () => {
    const items = buildCalendarItems({
      tasks: TASKS,
      events: EVENTS,
      visibleSourceIds: new Set(["vault"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.kind)).toEqual(["task"]);
  });

  it("keeps timed external events positioned by minutes from midnight", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: TIMED_EVENTS,
      visibleSourceIds: new Set(["work"]),
      includeCompletedTasks: false
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: "event:work:event-2",
        date: "2026-05-06",
        startMinutes: 570,
        endMinutes: 645,
        allDay: false
      })
    ]);
  });

  it("uses Apple per-calendar event colors before source colors", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: [
        {
          id: "event-3",
          sourceId: "apple-calendar",
          title: "Class",
          start: "2026-05-06T09:30:00",
          allDay: false,
          calendarId: "class",
          calendarColor: "#FF9500"
        }
      ],
      visibleSourceIds: new Set(["apple-calendar:class"]),
      includeCompletedTasks: false,
      sourceColors: { "apple-calendar:class": "#6f94b8" },
      eventColors: { class: "#34C759" }
    });

    expect(items[0]).toMatchObject({ color: "#34C759", sourceId: "apple-calendar:class" });
  });

  it("filters Apple Calendar events by their individual calendar layer", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: [
        {
          id: "work-event",
          sourceId: "apple-calendar",
          title: "Work",
          start: "2026-05-06T09:30:00",
          allDay: false,
          calendarId: "work"
        },
        {
          id: "class-event",
          sourceId: "apple-calendar",
          title: "Class",
          start: "2026-05-06T10:30:00",
          allDay: false,
          calendarId: "class"
        }
      ],
      visibleSourceIds: new Set(["apple-calendar:class"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.id)).toEqual(["event:apple-calendar:class:class-event"]);
  });

  it("expands multi-day Apple Calendar events across each visible day", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: [
        {
          id: "trip",
          sourceId: "apple-calendar",
          title: "Trip",
          start: "2026-09-17T09:00:00",
          end: "2026-09-19T18:00:00",
          allDay: false,
          calendarId: "work"
        }
      ],
      visibleSourceIds: new Set(["apple-calendar:work"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.date)).toEqual(["2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(items).toEqual([
      expect.objectContaining({ allDay: true, isMultiDayStart: true, isMultiDayEnd: false }),
      expect.objectContaining({ allDay: true, isMultiDayStart: false, isMultiDayEnd: false }),
      expect.objectContaining({ allDay: true, isMultiDayStart: false, isMultiDayEnd: true })
    ]);
  });

  it("treats all-day Apple Calendar end dates as exclusive", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: [
        {
          id: "single-all-day",
          sourceId: "holidays",
          title: "Single all-day",
          start: "2026-09-17",
          end: "2026-09-18",
          allDay: true
        }
      ],
      visibleSourceIds: new Set(["holidays"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.date)).toEqual(["2026-09-17"]);
    expect(items[0]).toMatchObject({ isMultiDay: false });
  });

  it("treats Apple all-day ISO end dates as exclusive", () => {
    const items = buildCalendarItems({
      tasks: [],
      events: [
        {
          id: "national-holiday",
          sourceId: "apple-calendar",
          title: "National Holiday",
          start: "2026-10-01T00:00:00",
          end: "2026-10-07T00:00:00",
          allDay: true,
          calendarId: "work"
        }
      ],
      visibleSourceIds: new Set(["apple-calendar:work"]),
      includeCompletedTasks: false
    });

    expect(items.map((item) => item.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06"
    ]);
  });
});

describe("getCalendarRange", () => {
  it("returns day, week, and month ranges", () => {
    expect(getCalendarRange("day", new Date("2026-05-06T09:00:00"), "monday")).toMatchObject({
      start: "2026-05-06",
      end: "2026-05-06"
    });
    expect(getCalendarRange("week", new Date("2026-05-06T09:00:00"), "monday")).toMatchObject({
      start: "2026-05-04",
      end: "2026-05-10"
    });
    expect(getCalendarRange("month", new Date("2026-05-06T09:00:00"), "monday")).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-31"
    });
  });

  it("uses the configured week start for week ranges", () => {
    expect(getCalendarRange("week", new Date("2026-05-06T09:00:00"), "wednesday")).toMatchObject({
      start: "2026-05-06",
      end: "2026-05-12"
    });
  });

  it("keeps month ranges scoped to the focused month", () => {
    expect(getCalendarRange("month", new Date("2026-05-06T09:00:00"), "sunday")).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-31"
    });
    expect(getCalendarRange("month", new Date("2026-05-06T09:00:00"), "wednesday")).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-31"
    });
  });
});

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task",
    filePath: "Inbox.md",
    line: 0,
    rawLine: "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: [],
    dueDate: overrides.dueDate,
    scheduledDate: overrides.scheduledDate,
    startDate: overrides.startDate,
    createdDate: overrides.createdDate,
    externalId: overrides.externalId,
    externalListId: overrides.externalListId,
    source: overrides.source ?? "vault"
  };
}
