import { parseTasksFromMarkdown } from "./taskParser";

describe("parseTasksFromMarkdown", () => {
  it("extracts open tasks with tags and emoji due dates", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Projects/Acme.md",
      content: "# Acme\n\n- [ ] Write proposal #client/acme 🛫 2026-05-08 ⏳ 2026-05-10"
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      filePath: "Projects/Acme.md",
      line: 2,
      completed: false,
      text: "Write proposal",
      tags: ["#client/acme"],
      startDate: "2026-05-08",
      scheduledDate: "2026-05-10",
      heading: "Acme"
    });
  });

  it("extracts completed tasks with due:: dates", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Inbox.md",
      content: "- [x] Send invoice #finance due:: 2026-05-11 ✅ 2026-05-12"
    });

    expect(tasks[0]).toMatchObject({
      completed: true,
      text: "Send invoice",
      tags: ["#finance"],
      dueDate: "2026-05-11",
      completedDate: "2026-05-12"
    });
  });

  it("extracts bare ISO dates from task text", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Project.md",
      content: "- [ ] 测试 2026-06-05"
    });

    expect(tasks[0]).toMatchObject({
      text: "测试",
      dueDate: "2026-06-05"
    });
  });

  it("keeps legacy due-date tasks compatible with the new planner fields", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Project.md",
      content: "- [ ] Legacy task 📅 2026-06-05 ⏰ 09:30"
    });

    expect(tasks[0]).toMatchObject({
      text: "Legacy task",
      dueDate: "2026-06-05",
      scheduledDate: "2026-06-05T09:30",
      startDate: undefined
    });
  });

  it("records indentation for nested tasks", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Project.md",
      content: "- [ ] Parent #work\n  - [ ] Child #work #next\n\t- [ ] Tab child #work"
    });

    expect(tasks.map((task) => task.indent)).toEqual([0, 1, 2]);
  });

  it("records parent task ids for nested tasks", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Project.md",
      content: "- [ ] Parent #project\n  - [ ] Child #next\n    - [ ] Grandchild #later\n- [ ] Sibling #project"
    });

    expect(tasks[0].parentId).toBeUndefined();
    expect(tasks[1].parentId).toBe(tasks[0].id);
    expect(tasks[2].parentId).toBe(tasks[1].id);
    expect(tasks[3].parentId).toBeUndefined();
  });

  it("ignores non-task checkboxes and malformed dates", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Inbox.md",
      content: "- [?] Maybe\n- [ ] Keep this 📅 tomorrow"
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueDate).toBeUndefined();
  });

  it("extracts recurrence without keeping it in the rendered task text", () => {
    const tasks = parseTasksFromMarkdown({
      filePath: "Inbox.md",
      content: "- [ ] Review budget #finance 📅 2026-06-08 repeat:: RRULE:FREQ=WEEKLY"
    });

    expect(tasks[0]).toMatchObject({
      text: "Review budget",
      tags: ["#finance"],
      dueDate: "2026-06-08",
      recurrence: "RRULE:FREQ=WEEKLY"
    });
  });
});
