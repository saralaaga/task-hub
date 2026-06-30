import { filterTasks, groupTasksByDateBucket, type TaskFilterState } from "./filters";
import type { TaskItem } from "../types";

const NOW = new Date("2026-05-06T09:00:00");

const TASKS: TaskItem[] = [
  task({ id: "overdue", text: "Call supplier", dueDate: "2026-05-01", tags: ["#work"], filePath: "Work/Suppliers.md" }),
  task({ id: "today", text: "Write proposal", dueDate: "2026-05-06", tags: ["#work", "#client/acme"], filePath: "Projects/Acme.md" }),
  task({ id: "tomorrow", text: "Ship draft", dueDate: "2026-05-07", tags: ["#work"], filePath: "Projects/Acme.md" }),
  task({ id: "week", text: "Review calendar", dueDate: "2026-05-10", tags: ["#review"], filePath: "Reviews/Weekly.md" }),
  task({ id: "future", text: "Renew license", dueDate: "2026-06-01", tags: ["#admin"], filePath: "Admin/Licenses.md" }),
  task({ id: "nodate", text: "Collect ideas", tags: ["#inbox"], filePath: "Inbox.md" }),
  task({ id: "done", text: "Paid invoice", completed: true, dueDate: "2026-05-06", tags: ["#finance"], filePath: "Finance.md" })
];

const BASE_FILTERS: TaskFilterState = {
  status: "open",
  tags: [],
  tagQuery: "",
  sourceQuery: "",
  textQuery: ""
};

describe("filterTasks", () => {
  it("hides completed tasks by default", () => {
    const results = filterTasks(TASKS, BASE_FILTERS, NOW);

    expect(results.map((item) => item.id)).not.toContain("done");
  });

  it("can show only completed tasks", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, status: "completed" }, NOW);

    expect(results.map((item) => item.id)).toEqual(["done"]);
  });

  it("orders open tasks before completed tasks when all statuses are visible", () => {
    const results = filterTasks(
      [
        task({ id: "done-first", completed: true, dueDate: "2026-05-06" }),
        task({ id: "open-second", dueDate: "2026-05-06" })
      ],
      { ...BASE_FILTERS, status: "all" },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["open-second", "done-first"]);
  });

  it("filters by date bucket", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, dateBucket: "thisWeek" }, NOW);

    expect(results.map((item) => item.id)).toEqual(["week"]);
  });

  it("uses scheduled date and start date for date buckets before falling back to legacy due dates", () => {
    const results = filterTasks(
      [
        task({ id: "scheduled", scheduledDate: "2026-05-10" }),
        task({ id: "started", startDate: "2026-05-10", dueDate: undefined }),
        task({ id: "legacy", dueDate: "2026-05-10" })
      ],
      { ...BASE_FILTERS, dateBucket: "thisWeek" },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["scheduled", "started", "legacy"]);
  });

  it("filters by all selected tags", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, tags: ["#work", "#client/acme"] }, NOW);

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("matches nested tags when filtering by their parent tag", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, tags: ["#client"] }, NOW);

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("supports a quick tag query that can be cleared independently of the saved tag list", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, tagQuery: "#client" }, NOW);

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("filters by source path and text query case-insensitively", () => {
    const results = filterTasks(TASKS, { ...BASE_FILTERS, sourceQuery: "projects", textQuery: "PROPOSAL" }, NOW);

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("matches text search against task tags from Apple Reminders", () => {
    const results = filterTasks(
      [
        task({ id: "restaurant", text: "Book table", tags: ["#p-天香居"], source: "apple-reminders", filePath: "Apple Reminders/MyNotes" }),
        task({ id: "other", text: "Buy groceries", tags: ["#p-超市"], source: "apple-reminders", filePath: "Apple Reminders/MyNotes" })
      ],
      { ...BASE_FILTERS, textQuery: "天香居" },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["restaurant"]);
  });

  it("filters source shortcuts by task source", () => {
    const results = filterTasks(
      [
        task({ id: "vault", source: "vault", filePath: "Inbox.md" }),
        task({ id: "reminder", source: "apple-reminders", filePath: "Apple Reminders/Inbox" })
      ],
      { ...BASE_FILTERS, sourceQuery: "apple-reminders" },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["reminder"]);
  });

  it("matches advanced conditions with AND semantics", () => {
    const results = filterTasks(
      TASKS,
      {
        ...BASE_FILTERS,
        conditions: {
          operator: "and",
          tag: "#work",
          dateBucket: "today",
          text: "proposal"
        }
      },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("matches advanced condition text against task tags", () => {
    const results = filterTasks(
      [
        task({ id: "restaurant", text: "Book table", tags: ["#p-天香居"], source: "apple-reminders" }),
        task({ id: "other", text: "Buy groceries", tags: ["#p-超市"], source: "apple-reminders" })
      ],
      {
        ...BASE_FILTERS,
        conditions: {
          operator: "and",
          tag: "",
          dateBucket: "",
          text: "天香居"
        }
      },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["restaurant"]);
  });

  it("matches multiple advanced condition tags from chip input", () => {
    const results = filterTasks(
      TASKS,
      {
        ...BASE_FILTERS,
        conditions: {
          operator: "and",
          tag: "#work #client",
          dateBucket: "",
          text: ""
        }
      },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["today"]);
  });

  it("matches advanced conditions with OR semantics", () => {
    const results = filterTasks(
      TASKS,
      {
        ...BASE_FILTERS,
        conditions: {
          operator: "or",
          tag: "#admin",
          dateBucket: "today",
          text: "ideas"
        }
      },
      NOW
    );

    expect(results.map((item) => item.id)).toEqual(["today", "future", "nodate"]);
  });
});

describe("groupTasksByDateBucket", () => {
  it("groups tasks into stable dashboard buckets", () => {
    const groups = groupTasksByDateBucket(TASKS.filter((taskItem) => !taskItem.completed), NOW);

    expect(groups.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(groups.today.map((item) => item.id)).toEqual(["today"]);
    expect(groups.tomorrow.map((item) => item.id)).toEqual(["tomorrow"]);
    expect(groups.thisWeek.map((item) => item.id)).toEqual(["week"]);
    expect(groups.future.map((item) => item.id)).toEqual(["future"]);
    expect(groups.noDate.map((item) => item.id)).toEqual(["nodate"]);
  });

  it("keeps completed current and future tasks in their original date buckets", () => {
    const groups = groupTasksByDateBucket(
      [
        task({ id: "done-first", text: "Done first", completed: true, dueDate: "2026-05-06" }),
        task({ id: "open-second", text: "Open second", dueDate: "2026-05-06" }),
        task({ id: "done-third", text: "Done third", completed: true, dueDate: "2026-05-06" }),
        task({ id: "open-fourth", text: "Open fourth", dueDate: "2026-05-06" }),
        task({ id: "done-tomorrow", text: "Done tomorrow", completed: true, dueDate: "2026-05-07" }),
        task({ id: "done-week", text: "Done week", completed: true, dueDate: "2026-05-10" }),
        task({ id: "done-future", text: "Done future", completed: true, dueDate: "2026-06-01" }),
        task({ id: "done-nodate", text: "Done no date", completed: true })
      ],
      NOW
    );

    expect(groups.today.map((item) => item.id)).toEqual(["open-second", "open-fourth", "done-first", "done-third"]);
    expect(groups.tomorrow.map((item) => item.id)).toEqual(["done-tomorrow"]);
    expect(groups.thisWeek.map((item) => item.id)).toEqual(["done-week"]);
    expect(groups.future.map((item) => item.id)).toEqual(["done-future"]);
    expect(groups.noDate.map((item) => item.id)).toEqual(["done-nodate"]);
    expect(groups.otherCompleted).toEqual([]);
  });

  it("groups completed overdue tasks into other completed instead of overdue", () => {
    const groups = groupTasksByDateBucket(
      [
        task({ id: "done-overdue", text: "Done overdue", completed: true, dueDate: "2026-05-01" }),
        task({ id: "open-overdue", text: "Open overdue", dueDate: "2026-05-01" })
      ],
      NOW
    );

    expect(groups.overdue.map((item) => item.id)).toEqual(["open-overdue"]);
    expect(groups.otherCompleted.map((item) => item.id)).toEqual(["done-overdue"]);
  });
});

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: overrides.id ?? "task",
    filePath: overrides.filePath ?? "Inbox.md",
    line: 0,
    rawLine: "- [ ] Task",
    text: overrides.text ?? "Task",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate,
    scheduledDate: overrides.scheduledDate,
    startDate: overrides.startDate,
    heading: overrides.heading,
    contextPreview: overrides.contextPreview,
    source: overrides.source ?? "vault"
  };
}
