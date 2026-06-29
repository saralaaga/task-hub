import { completeTaskInContent, deleteTaskInContent, rescheduleTaskInContent, updateTaskLineInContent } from "./taskActions";
import type { TaskItem } from "../types";

describe("completeTaskInContent", () => {
  it("updates the direct indexed line when it still matches", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("Intro\n- [ ] Pay invoice #finance\nOutro", task, undefined, "complete", "2026-06-28");

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [x] Pay invoice #finance ✅ 2026-06-28\nOutro",
      line: 1
    });
  });

  it("finds the same task near the indexed line when lines drift", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("New intro\nIntro\n- [ ] Pay invoice #finance\nOutro", task, undefined, "complete", "2026-06-28");

    expect(result).toEqual({
      status: "updated",
      content: "New intro\nIntro\n- [x] Pay invoice #finance ✅ 2026-06-28\nOutro",
      line: 2
    });
  });

  it("treats an already completed direct line as already in state", () => {
    const task = taskItem({ line: 0, rawLine: "- [x] Pay invoice #finance", completed: true });
    const result = completeTaskInContent("- [x] Pay invoice #finance", task);

    expect(result).toEqual({ status: "already_in_state" });
  });

  it("reopens the direct indexed line when requested", () => {
    const task = taskItem({ line: 1, rawLine: "- [x] Pay invoice #finance ✅ 2026-06-28", completed: true, completedDate: "2026-06-28" });
    const result = completeTaskInContent("Intro\n- [x] Pay invoice #finance ✅ 2026-06-28\nOutro", task, undefined, "reopen");

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [ ] Pay invoice #finance\nOutro",
      line: 1
    });
  });

  it("does not duplicate an existing completion date when completing a done task line format", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice #finance ✅ 2026-06-20" });
    const result = completeTaskInContent("- [ ] Pay invoice #finance ✅ 2026-06-20", task, undefined, "complete", "2026-06-28");

    expect(result).toEqual({
      status: "updated",
      content: "- [x] Pay invoice #finance ✅ 2026-06-28",
      line: 0
    });
  });

  it("returns a conflict instead of changing a different task", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("- [ ] Call supplier #work", task);

    expect(result.status).toBe("conflict");
  });

  it("does not treat a different completed task as already in state", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("- [x] Call supplier #work", task);

    expect(result.status).toBe("conflict");
  });

  it("completes a recurring task and adds the next open occurrence below it", () => {
    const task = taskItem({
      line: 0,
      rawLine: "- [ ] Review budget 🛫 2026-06-08 ⏳ 2026-06-08 repeat:: RRULE:FREQ=WEEKLY #finance",
      startDate: "2026-06-08",
      scheduledDate: "2026-06-08",
      recurrence: "RRULE:FREQ=WEEKLY"
    });
    const result = completeTaskInContent(
      "- [ ] Review budget 🛫 2026-06-08 ⏳ 2026-06-08 repeat:: RRULE:FREQ=WEEKLY #finance",
      task,
      undefined,
      "complete",
      "2026-06-28"
    );

    expect(result).toEqual({
      status: "updated",
      content: "- [x] Review budget 🛫 2026-06-08 ⏳ 2026-06-08 repeat:: RRULE:FREQ=WEEKLY #finance ✅ 2026-06-28\n- [ ] Review budget 🛫 2026-06-15 ⏳ 2026-06-15 repeat:: RRULE:FREQ=WEEKLY #finance",
      line: 0
    });
  });
});

describe("rescheduleTaskInContent", () => {
  it("updates an emoji due date on the direct indexed line", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("Intro\n- [ ] Pay invoice 📅 2026-05-08 #finance\nOutro", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12 #finance\nOutro",
      line: 1
    });
  });

  it("adds a scheduled time when rescheduling to a timed target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08 #finance", task, "2026-05-12", undefined, 570);

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12 ⏰ 09:30 #finance",
      line: 0
    });
  });

  it("updates an existing scheduled time when rescheduling to a timed target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", task, "2026-05-12", undefined, 570);

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12 ⏰ 09:30 #finance",
      line: 0
    });
  });

  it("removes an existing scheduled time when rescheduling to an all-day target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 08:15 #finance", startDate: "2026-05-08", scheduledDate: "2026-05-08T08:15" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 08:15 #finance", task, "2026-05-08");

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 #finance",
      line: 0
    });
  });

  it("keeps an untimed task already in state when dropped on its current all-day target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08 #finance", task, "2026-05-08");

    expect(result).toEqual({ status: "already_in_state" });
  });

  it("updates an inline due date while preserving completed state and text", () => {
    const task = taskItem({ line: 0, rawLine: "- [x] Pay invoice due:: 2026-05-08 #finance", completed: true, dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [x] Pay invoice due:: 2026-05-08 #finance", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "- [x] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12 #finance",
      line: 0
    });
  });

  it("updates a bare due date on the direct indexed line", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] 测试 2026-06-05", dueDate: "2026-06-05" });
    const result = rescheduleTaskInContent("- [ ] 测试 2026-06-05", task, "2026-06-09");

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] 测试 🛫 2026-06-05 ⏳ 2026-06-09",
      line: 0
    });
  });

  it("finds the same task near the indexed line when lines drift", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("New intro\nIntro\n- [ ] Pay invoice 📅 2026-05-08\nOutro", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "New intro\nIntro\n- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12\nOutro",
      line: 2
    });
  });

  it("returns already_in_state when the task is dropped on its current date", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08", task, "2026-05-08");

    expect(result).toEqual({ status: "already_in_state" });
  });

  it("returns a conflict when the indexed line no longer matches", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Call supplier 📅 2026-05-08", task, "2026-05-12");

    expect(result.status).toBe("conflict");
  });

  it("adds an emoji due token when an unscheduled task is dropped on an all-day target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice #finance", dueDate: undefined });
    const result = rescheduleTaskInContent("- [ ] Pay invoice #finance", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-12 ⏳ 2026-05-12 #finance",
      line: 0
    });
  });

  it("adds emoji due and scheduled time tokens when an unscheduled task is dropped on a timed target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice #finance", dueDate: undefined });
    const result = rescheduleTaskInContent("- [ ] Pay invoice #finance", task, "2026-05-12", undefined, 570);

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-12 ⏳ 2026-05-12 ⏰ 09:30 #finance",
      line: 0
    });
  });

  it("returns a conflict when a scheduled task line has no supported due token", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-12",
      line: 0
    });
  });
});

describe("deleteTaskInContent", () => {
  it("deletes the direct indexed task line when it still matches", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08" });
    const result = deleteTaskInContent("Intro\n- [ ] Pay invoice 📅 2026-05-08\nOutro", task);

    expect(result).toEqual({
      status: "updated",
      content: "Intro\nOutro",
      line: 1
    });
  });

  it("finds and deletes the same task near the indexed line when lines drift", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08" });
    const result = deleteTaskInContent("New intro\nIntro\n- [ ] Pay invoice 📅 2026-05-08\nOutro", task);

    expect(result).toEqual({
      status: "updated",
      content: "New intro\nIntro\nOutro",
      line: 2
    });
  });

  it("returns a conflict instead of deleting a different task", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08" });
    const result = deleteTaskInContent("- [ ] Call supplier 📅 2026-05-08", task);

    expect(result.status).toBe("conflict");
  });
});

describe("updateTaskLineInContent", () => {
  it("updates title, date, time, and tags while preserving the task marker", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", dueDate: "2026-05-08" });
    const result = updateTaskLineInContent("- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", task, {
      title: "Send invoice",
      date: "2026-05-12",
      startTime: "09:30",
      tags: ["#finance", "#client/acme"]
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Send invoice 🛫 2026-05-08 ⏳ 2026-05-12 ⏰ 09:30 #finance #client/acme",
      line: 0
    });
  });

  it("adds a due token when a dated task line did not have one yet", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice", dueDate: undefined, tags: [] });
    const result = updateTaskLineInContent("- [ ] Pay invoice", task, {
      title: "Pay invoice",
      date: "2026-05-12",
      startTime: "",
      tags: []
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-12 ⏳ 2026-05-12",
      line: 0
    });
  });

  it("removes a bare date from the edited title and writes the selected date canonically", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] 测试 2026-06-05", dueDate: "2026-06-05", tags: [] });
    const result = updateTaskLineInContent("- [ ] 测试 2026-06-05", task, {
      title: "测试",
      date: "2026-06-09",
      startTime: "",
      tags: []
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] 测试 🛫 2026-06-05 ⏳ 2026-06-09",
      line: 0
    });
  });

  it("removes a scheduled time when the draft time is empty", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 08:15 #finance", startDate: "2026-05-08", scheduledDate: "2026-05-08T08:15" });
    const result = updateTaskLineInContent("- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 08:15 #finance", task, {
      title: "Pay invoice",
      date: "2026-05-08",
      startTime: "",
      tags: ["#finance"]
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 #finance",
      line: 0
    });
  });

  it("updates recurrence when editing a task line", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 repeat:: RRULE:FREQ=WEEKLY #finance", startDate: "2026-05-08", scheduledDate: "2026-05-08", recurrence: "RRULE:FREQ=WEEKLY" });
    const result = updateTaskLineInContent("- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 repeat:: RRULE:FREQ=WEEKLY #finance", task, {
      title: "Pay invoice",
      date: "2026-05-08",
      startTime: "",
      tags: ["#finance"],
      recurrence: "RRULE:FREQ=MONTHLY"
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 repeat:: RRULE:FREQ=MONTHLY #finance",
      line: 0
    });
  });

  it("clears recurrence when editing a recurring task line", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 repeat:: RRULE:FREQ=WEEKLY #finance", startDate: "2026-05-08", scheduledDate: "2026-05-08", recurrence: "RRULE:FREQ=WEEKLY" });
    const result = updateTaskLineInContent("- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 repeat:: RRULE:FREQ=WEEKLY #finance", task, {
      title: "Pay invoice",
      date: "2026-05-08",
      startTime: "",
      tags: ["#finance"],
      recurrence: null
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 🛫 2026-05-08 ⏳ 2026-05-08 #finance",
      line: 0
    });
  });

  it("returns a conflict instead of editing a changed line", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08", dueDate: "2026-05-08" });
    const result = updateTaskLineInContent("- [ ] Call supplier 📅 2026-05-08", task, {
      title: "Pay invoice",
      date: "2026-05-12",
      tags: []
    });

    expect(result.status).toBe("conflict");
  });
});

function taskItem(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: "Finance.md:0:abc",
    filePath: "Finance.md",
    line: overrides.line ?? 0,
    rawLine: overrides.rawLine ?? "- [ ] Pay invoice",
    text: overrides.text ?? "Pay invoice",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? ["#finance"],
    dueDate: overrides.dueDate,
    scheduledDate: overrides.scheduledDate,
    startDate: overrides.startDate,
    recurrence: overrides.recurrence,
    completedDate: overrides.completedDate,
    heading: overrides.heading,
    contextPreview: overrides.contextPreview,
    source: "vault"
  };
}
