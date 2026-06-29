import { DIDA_INBOX_PROJECT_NAME, didaTaskToTaskItem, taskItemToDidaPayload } from "./didaMapping";

describe("dida task mapping", () => {
  it("maps a timed Dida task to a Task Hub task", () => {
    const task = didaTaskToTaskItem(
      {
        id: "task-1",
        projectId: "project-1",
        title: "Submit report #work",
        content: "Bring the spreadsheet",
        status: 0,
        isAllDay: false,
        dueDate: "2026-06-02T09:30:00+0800",
        timeZone: "Asia/Shanghai",
        priority: 3,
        repeatFlag: "RRULE:FREQ=WEEKLY",
        tags: ["work"]
      },
      { id: "project-1", name: "Inbox" },
      0
    );

    expect(task).toMatchObject({
      id: "dida:task-1",
      filePath: "Dida/Inbox",
      text: "Submit report #work",
      completed: false,
      tags: ["#work"],
      dueDate: "2026-06-02",
      startDate: undefined,
      scheduledDate: "2026-06-02T09:30",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1",
      externalSourceName: "Inbox",
      priority: "3",
      recurrence: "RRULE:FREQ=WEEKLY",
      contextPreview: "Bring the spreadsheet"
    });
  });

  it("maps Dida zoned midnight responses to the intended local all-day date", () => {
    const task = didaTaskToTaskItem(
      {
        id: "task-all-day",
        projectId: "project-1",
        title: "All-day task",
        status: 0,
        isAllDay: true,
        dueDate: "2026-06-08T16:00:00.000+0000",
        timeZone: "Asia/Shanghai"
      },
      { id: "project-1", name: "Inbox" },
      0
    );

    expect(task).toMatchObject({
      dueDate: "2026-06-09",
      scheduledDate: "2026-06-09"
    });
  });

  it("keeps Dida start dates separate from scheduled dates", () => {
    const task = didaTaskToTaskItem(
      {
        id: "task-plan-split",
        projectId: "project-1",
        title: "Plan split",
        status: 0,
        isAllDay: true,
        startDate: "2026-06-01T00:00:00+0800",
        dueDate: "2026-06-08T00:00:00+0800"
      },
      { id: "project-1", name: "Inbox" },
      0
    );

    expect(task).toMatchObject({
      startDate: "2026-06-01",
      scheduledDate: "2026-06-08",
      dueDate: "2026-06-08"
    });
  });

  it("names the Dida inbox as 收集箱", () => {
    const task = didaTaskToTaskItem(
      {
        id: "task-inbox",
        projectId: "inbox",
        title: "Capture loose task",
        status: 0
      },
      { id: "inbox", name: DIDA_INBOX_PROJECT_NAME },
      0
    );

    expect(DIDA_INBOX_PROJECT_NAME).toBe("收集箱");
    expect(task.filePath).toBe("Dida/收集箱");
    expect(task.externalSourceName).toBe("收集箱");
  });

  it("builds an update payload with date, time, reminder, notes, tags, and project", () => {
    expect(
      taskItemToDidaPayload({
        title: "Submit report",
        projectId: "project-2",
        notes: "Bring the spreadsheet",
        date: "2026-06-02",
        startDate: "2026-05-30",
        startMinutes: 570,
        tags: ["#work", "client"],
        reminderOffsetMinutes: 30,
        repeatFlag: "RRULE:FREQ=WEEKLY"
      })
    ).toEqual({
      title: "Submit report",
      projectId: "project-2",
      content: "Bring the spreadsheet",
      desc: "Bring the spreadsheet",
      isAllDay: false,
      startDate: "2026-05-30T00:00:00+0800",
      dueDate: "2026-06-02T09:30:00+0800",
      timeZone: "Asia/Shanghai",
      tags: ["work", "client"],
      reminders: ["TRIGGER:-PT30M"],
      repeatFlag: "RRULE:FREQ=WEEKLY"
    });
  });

  it("can send an empty Dida repeatFlag to clear recurrence", () => {
    expect(taskItemToDidaPayload({ title: "Submit report", repeatFlag: "" })).toEqual({
      title: "Submit report",
      repeatFlag: ""
    });
  });
});
