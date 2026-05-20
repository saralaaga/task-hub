import { completeTaskInContent, deleteTaskInContent, rescheduleTaskInContent, updateTaskLineInContent } from "./taskActions";
import type { TaskItem } from "../types";

describe("completeTaskInContent", () => {
  it("updates the direct indexed line when it still matches", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("Intro\n- [ ] Pay invoice #finance\nOutro", task);

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [x] Pay invoice #finance\nOutro",
      line: 1
    });
  });

  it("finds the same task near the indexed line when lines drift", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice #finance" });
    const result = completeTaskInContent("New intro\nIntro\n- [ ] Pay invoice #finance\nOutro", task);

    expect(result).toEqual({
      status: "updated",
      content: "New intro\nIntro\n- [x] Pay invoice #finance\nOutro",
      line: 2
    });
  });

  it("treats an already completed direct line as already in state", () => {
    const task = taskItem({ line: 0, rawLine: "- [x] Pay invoice #finance", completed: true });
    const result = completeTaskInContent("- [x] Pay invoice #finance", task);

    expect(result).toEqual({ status: "already_in_state" });
  });

  it("reopens the direct indexed line when requested", () => {
    const task = taskItem({ line: 1, rawLine: "- [x] Pay invoice #finance", completed: true });
    const result = completeTaskInContent("Intro\n- [x] Pay invoice #finance\nOutro", task, undefined, "reopen");

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [ ] Pay invoice #finance\nOutro",
      line: 1
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
});

describe("rescheduleTaskInContent", () => {
  it("updates an emoji due date on the direct indexed line", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("Intro\n- [ ] Pay invoice 📅 2026-05-08 #finance\nOutro", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "Intro\n- [ ] Pay invoice 📅 2026-05-12 #finance\nOutro",
      line: 1
    });
  });

  it("adds a scheduled time when rescheduling to a timed target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08 #finance", task, "2026-05-12", undefined, 570);

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 📅 2026-05-12 ⏰ 09:30 #finance",
      line: 0
    });
  });

  it("updates an existing scheduled time when rescheduling to a timed target", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", task, "2026-05-12", undefined, 570);

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 📅 2026-05-12 ⏰ 09:30 #finance",
      line: 0
    });
  });

  it("updates an inline due date while preserving completed state and text", () => {
    const task = taskItem({ line: 0, rawLine: "- [x] Pay invoice due:: 2026-05-08 #finance", completed: true, dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [x] Pay invoice due:: 2026-05-08 #finance", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "- [x] Pay invoice due:: 2026-05-12 #finance",
      line: 0
    });
  });

  it("finds the same task near the indexed line when lines drift", () => {
    const task = taskItem({ line: 1, rawLine: "- [ ] Pay invoice 📅 2026-05-08", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("New intro\nIntro\n- [ ] Pay invoice 📅 2026-05-08\nOutro", task, "2026-05-12");

    expect(result).toEqual({
      status: "updated",
      content: "New intro\nIntro\n- [ ] Pay invoice 📅 2026-05-12\nOutro",
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

  it("returns a conflict when the matched line has no supported due token", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice", dueDate: "2026-05-08" });
    const result = rescheduleTaskInContent("- [ ] Pay invoice", task, "2026-05-12");

    expect(result.status).toBe("conflict");
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
      content: "- [ ] Send invoice 📅 2026-05-12 ⏰ 09:30 #finance #client/acme",
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
      content: "- [ ] Pay invoice 📅 2026-05-12",
      line: 0
    });
  });

  it("removes a scheduled time when the draft time is empty", () => {
    const task = taskItem({ line: 0, rawLine: "- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", dueDate: "2026-05-08" });
    const result = updateTaskLineInContent("- [ ] Pay invoice 📅 2026-05-08 ⏰ 08:15 #finance", task, {
      title: "Pay invoice",
      date: "2026-05-08",
      startTime: "",
      tags: ["#finance"]
    });

    expect(result).toEqual({
      status: "updated",
      content: "- [ ] Pay invoice 📅 2026-05-08 #finance",
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
    heading: overrides.heading,
    contextPreview: overrides.contextPreview,
    source: "vault"
  };
}
