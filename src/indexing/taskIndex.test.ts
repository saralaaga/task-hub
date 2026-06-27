import { TaskIndex, type IndexableFile } from "./taskIndex";
import { parseTasksFromMarkdown } from "../parsing/taskParser";
import type { PersistedVaultTaskStableRecord } from "../types";

describe("TaskIndex", () => {
  it("skips unchanged files based on mtime and size", async () => {
    const reads: string[] = [];
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: (file) => {
        reads.push(file.path);
        return "- [ ] First task";
      }
    });

    const file = markdownFile({ path: "Inbox.md", mtime: 1, size: 16 });
    await index.scanFiles([file]);
    await index.scanFiles([file]);

    expect(reads).toEqual(["Inbox.md"]);
    expect(index.getTasks()).toHaveLength(1);
  });

  it("replaces tasks when a file changes", async () => {
    const contents = ["- [ ] First task", "- [ ] Second task #next"];
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: () => contents.shift() ?? ""
    });

    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 1, size: 16 })]);
    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 2, size: 24 })]);

    expect(index.getTasks().map((task) => task.text)).toEqual(["Second task"]);
    expect(index.getTasks()[0].tags).toEqual(["#next"]);
  });

  it("keeps a changed file's tasks in their previous global order slot after reindex", async () => {
    const contentsByPath: Record<string, string[]> = {
      "A.md": ["- [ ] Alpha 📅 2026-05-08", "- [ ] Alpha #tag 📅 2026-05-08"],
      "B.md": ["- [ ] Beta 📅 2026-05-08"]
    };
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: (file) => contentsByPath[file.path].shift() ?? ""
    });

    await index.scanFiles([
      markdownFile({ path: "A.md", mtime: 1, size: 24 }),
      markdownFile({ path: "B.md", mtime: 1, size: 23 })
    ]);
    expect(index.getTasks().map((task) => task.text)).toEqual(["Alpha", "Beta"]);

    await index.reindexFile(markdownFile({ path: "A.md", mtime: 2, size: 29 }));

    expect(index.getTasks().map((task) => task.text)).toEqual(["Alpha", "Beta"]);
    expect(index.getTasks()[0].tags).toEqual(["#tag"]);
  });

  it("removes tasks for deleted files", async () => {
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: () => "- [ ] Task"
    });

    await index.scanFiles([markdownFile({ path: "Inbox.md" })]);
    index.removeFile("Inbox.md");

    expect(index.getTasks()).toEqual([]);
    expect(index.getFileState("Inbox.md")).toBeUndefined();
  });

  it("skips ignored paths", async () => {
    const index = new TaskIndex({
      ignoredPaths: ["Archive/"],
      readFile: () => "- [ ] Archived task"
    });

    await index.scanFiles([markdownFile({ path: "Archive/Old.md" })]);

    expect(index.getTasks()).toEqual([]);
    expect(index.getStats().skipped).toBe(1);
  });

  it("records failed files without stopping other files", async () => {
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: (file) => {
        if (file.path === "Broken.md") throw new Error("read failed");
        return "- [ ] Good task";
      }
    });

    await index.scanFiles([markdownFile({ path: "Broken.md" }), markdownFile({ path: "Good.md" })]);

    expect(index.getTasks().map((task) => task.text)).toEqual(["Good task"]);
    expect(index.getFileState("Broken.md")?.lastError).toContain("read failed");
    expect(index.getStats().failed).toBe(1);
  });

  it("persists stable ids across file line changes", async () => {
    const contents = ["- [ ] First task", "\n- [ ] First task"];
    const persistedByPath: Record<string, PersistedVaultTaskStableRecord[]> = {};
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: () => contents.shift() ?? "",
      loadPersistedTaskState: (path) => persistedByPath[path],
      savePersistedTaskState: (path, records) => {
        persistedByPath[path] = records;
      }
    });

    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 1, size: 16 })]);
    const firstStableId = index.getTasks()[0].stableId;
    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 2, size: 18 })]);

    expect(index.getTasks()[0].stableId).toBe(firstStableId);
    expect(persistedByPath["Inbox.md"][0].stableId).toBe(firstStableId);
  });

  it("honors remembered stable ids for task hub initiated updates", async () => {
    const contents = ["- [ ] First task", "- [ ] Renamed task"];
    const persistedByPath: Record<string, PersistedVaultTaskStableRecord[]> = {};
    const index = new TaskIndex({
      ignoredPaths: [],
      readFile: () => contents.shift() ?? "",
      loadPersistedTaskState: (path) => persistedByPath[path],
      savePersistedTaskState: (path, records) => {
        persistedByPath[path] = records;
      }
    });

    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 1, size: 16 })]);
    const firstTask = index.getTasks()[0];
    const renamedTaskId = parseTasksFromMarkdown({
      filePath: "Inbox.md",
      content: "- [ ] Renamed task"
    })[0].id;
    index.rememberStableIdForTask(
      {
        filePath: "Inbox.md",
        id: renamedTaskId
      },
      firstTask.stableId as string
    );

    await index.scanFiles([markdownFile({ path: "Inbox.md", mtime: 2, size: 18 })]);

    expect(index.getTasks()[0].stableId).toBe(firstTask.stableId);
  });
});

function markdownFile(overrides: Partial<IndexableFile> & { mtime?: number; size?: number }): IndexableFile {
  return {
    path: overrides.path ?? "Inbox.md",
    extension: overrides.extension ?? "md",
    stat: {
      ctime: overrides.stat?.ctime ?? 1,
      mtime: overrides.stat?.mtime ?? overrides.mtime ?? 1,
      size: overrides.stat?.size ?? overrides.size ?? 16
    }
  };
}
