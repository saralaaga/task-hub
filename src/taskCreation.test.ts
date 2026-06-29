import { parseTasksFromMarkdown } from "./parsing/taskParser";
import { appendTaskToContent, createTaskLine, normalizeTaskCreationFilePath } from "./taskCreation";

describe("task creation helpers", () => {
  it("falls back to the default task creation file path", () => {
    expect(normalizeTaskCreationFilePath("")).toBe("Task Hub.md");
  });

  it("adds a markdown extension when the task creation file path has no extension", () => {
    expect(normalizeTaskCreationFilePath("Tasks/Inbox")).toBe("Tasks/Inbox.md");
  });

  it("appends task lines to empty and non-empty content", () => {
    const line = createTaskLine("Buy milk", "2026-05-08");

    expect(appendTaskToContent("", line)).toBe("- [ ] Buy milk 🛫 2026-05-08 ⏳ 2026-05-08\n");
    expect(appendTaskToContent("# Inbox", line)).toBe("# Inbox\n- [ ] Buy milk 🛫 2026-05-08 ⏳ 2026-05-08\n");
    expect(appendTaskToContent("# Inbox\n", line)).toBe("# Inbox\n- [ ] Buy milk 🛫 2026-05-08 ⏳ 2026-05-08\n");
  });

  it("creates task lines that the existing parser can place on the calendar", () => {
    const content = appendTaskToContent("", createTaskLine("Buy milk #errand", "2026-05-08"));

    expect(parseTasksFromMarkdown({ filePath: "Task Hub.md", content })).toMatchObject([
      {
        text: "Buy milk",
        tags: ["#errand"],
        startDate: "2026-05-08",
        scheduledDate: "2026-05-08",
        source: "vault"
      }
    ]);
  });

  it("folds multiline user input into one task line", () => {
    expect(createTaskLine("Buy\nmilk\tsoon", "2026-05-08")).toBe("- [ ] Buy milk soon 🛫 2026-05-08 ⏳ 2026-05-08");
  });

  it("creates timed task lines that the parser can place on the time grid", () => {
    const content = appendTaskToContent("", createTaskLine("Buy milk", "2026-05-08", 570));

    expect(content).toBe("- [ ] Buy milk 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 09:30\n");
    expect(parseTasksFromMarkdown({ filePath: "Task Hub.md", content })).toMatchObject([
      {
        text: "Buy milk",
        startDate: "2026-05-08",
        scheduledDate: "2026-05-08T09:30"
      }
    ]);
  });

  it("keeps timed task creation to five-minute precision", () => {
    const content = appendTaskToContent("", createTaskLine("Buy milk", "2026-05-08", 9 * 60 + 7));

    expect(content).toBe("- [ ] Buy milk 🛫 2026-05-08 ⏳ 2026-05-08 ⏰ 09:05\n");
    expect(parseTasksFromMarkdown({ filePath: "Task Hub.md", content })).toMatchObject([
      {
        scheduledDate: "2026-05-08T09:05"
      }
    ]);
  });

  it("creates recurring task lines that the parser can read", () => {
    const content = appendTaskToContent("", createTaskLine("Review budget", "2026-06-08", undefined, "RRULE:FREQ=WEEKLY"));

    expect(content).toBe("- [ ] Review budget 🛫 2026-06-08 ⏳ 2026-06-08 repeat:: RRULE:FREQ=WEEKLY\n");
    expect(parseTasksFromMarkdown({ filePath: "Task Hub.md", content })).toMatchObject([
      {
        text: "Review budget",
        startDate: "2026-06-08",
        scheduledDate: "2026-06-08",
        recurrence: "RRULE:FREQ=WEEKLY"
      }
    ]);
  });
});
