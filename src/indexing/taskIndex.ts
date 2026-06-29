import { parseTasksFromMarkdown } from "../parsing/taskParser";
import type { IndexedFileState, PersistedVaultTaskStableRecord, TaskItem } from "../types";

export type IndexableFile = {
  path: string;
  extension: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
};

export type TaskIndexStats = {
  indexed: number;
  skipped: number;
  failed: number;
  taskCount: number;
  lastScanAt?: string;
};

type TaskIndexOptions = {
  ignoredPaths: string[];
  readFile: (file: IndexableFile) => string | Promise<string>;
  loadPersistedTaskState?: (path: string) => PersistedVaultTaskStableRecord[] | undefined;
  savePersistedTaskState?: (path: string, records: PersistedVaultTaskStableRecord[]) => void;
  deletePersistedTaskState?: (path: string) => void;
  createStableId?: () => string;
  now?: () => Date;
};

export class TaskIndex {
  private readonly tasksById = new Map<string, TaskItem>();
  private readonly taskIdsByPath = new Map<string, string[]>();
  private readonly fileStateByPath = new Map<string, IndexedFileState>();
  private readonly pendingStableIdOverridesByPath = new Map<string, Map<string, string>>();
  private persistenceDirty = false;
  private stats: TaskIndexStats = {
    indexed: 0,
    skipped: 0,
    failed: 0,
    taskCount: 0
  };

  constructor(private readonly options: TaskIndexOptions) {}

  async scanFiles(files: IndexableFile[]): Promise<void> {
    this.stats = {
      indexed: 0,
      skipped: 0,
      failed: 0,
      taskCount: this.tasksById.size,
      lastScanAt: this.nowIso()
    };

    for (const file of files) {
      await this.reindexFile(file);
    }

    this.stats.taskCount = this.tasksById.size;
  }

  async reindexFile(file: IndexableFile): Promise<void> {
    if (file.extension !== "md" || this.isIgnored(file.path)) {
      this.stats.skipped += 1;
      return;
    }

    const previousState = this.fileStateByPath.get(file.path);
    if (
      previousState &&
      !previousState.lastError &&
      previousState.mtime === file.stat.mtime &&
      previousState.size === file.stat.size
    ) {
      this.stats.skipped += 1;
      return;
    }

    try {
      const content = await this.options.readFile(file);
      const tasks = this.assignStableIds(
        file.path,
        parseTasksFromMarkdown({ filePath: file.path, content }),
        this.previousTasksForPath(file.path)
      );
      this.replaceFileTasks(file.path, tasks);
      this.persistStableState(file.path, tasks);
      this.fileStateByPath.set(file.path, {
        path: file.path,
        ctime: file.stat.ctime,
        mtime: file.stat.mtime,
        size: file.stat.size,
        taskIds: tasks.map((task) => task.id),
        lastIndexedAt: this.nowIso()
      });
      this.stats.indexed += 1;
    } catch (error) {
      this.removeFileTasks(file.path);
      this.fileStateByPath.set(file.path, {
        path: file.path,
        ctime: file.stat.ctime,
        mtime: file.stat.mtime,
        size: file.stat.size,
        taskIds: [],
        lastIndexedAt: this.nowIso(),
        lastError: error instanceof Error ? error.message : String(error)
      });
      this.stats.failed += 1;
    } finally {
      this.stats.taskCount = this.tasksById.size;
    }
  }

  removeFile(path: string): void {
    this.removeFileTasks(path);
    this.fileStateByPath.delete(path);
    if (this.options.loadPersistedTaskState?.(path)?.length) {
      this.options.deletePersistedTaskState?.(path);
      this.persistenceDirty = true;
    }
    this.pendingStableIdOverridesByPath.delete(path);
    this.stats.taskCount = this.tasksById.size;
  }

  getTasks(): TaskItem[] {
    return Array.from(this.tasksById.values());
  }

  rememberStableIdForTask(task: Pick<TaskItem, "filePath" | "id">, stableId: string): void {
    const overrides = this.pendingStableIdOverridesByPath.get(task.filePath) ?? new Map<string, string>();
    overrides.set(task.id, stableId);
    this.pendingStableIdOverridesByPath.set(task.filePath, overrides);
  }

  consumePersistenceDirty(): boolean {
    const dirty = this.persistenceDirty;
    this.persistenceDirty = false;
    return dirty;
  }

  getFileState(path: string): IndexedFileState | undefined {
    return this.fileStateByPath.get(path);
  }

  getStats(): TaskIndexStats {
    return { ...this.stats, taskCount: this.tasksById.size };
  }

  private replaceFileTasks(path: string, tasks: TaskItem[]): void {
    const previousTaskIds = this.taskIdsByPath.get(path) ?? [];
    const previousEntries = Array.from(this.tasksById.entries());
    const previousTaskIdSet = new Set(previousTaskIds);
    const insertAt = previousEntries.findIndex(([taskId]) => previousTaskIdSet.has(taskId));
    const nextEntries = previousEntries.filter(([taskId]) => !previousTaskIdSet.has(taskId));
    const replacementEntries: Array<[string, TaskItem]> = tasks.map((task) => [task.id, task]);
    if (insertAt === -1) {
      nextEntries.push(...replacementEntries);
    } else {
      nextEntries.splice(insertAt, 0, ...replacementEntries);
    }
    this.tasksById.clear();
    for (const [taskId, task] of nextEntries) {
      this.tasksById.set(taskId, task);
    }
    this.taskIdsByPath.set(path, tasks.map((task) => task.id));
  }

  private removeFileTasks(path: string): void {
    const previousTaskIds = this.taskIdsByPath.get(path) ?? [];
    for (const taskId of previousTaskIds) {
      this.tasksById.delete(taskId);
    }
    this.taskIdsByPath.delete(path);
  }

  private isIgnored(path: string): boolean {
    return this.options.ignoredPaths.some((ignoredPath) => path.startsWith(ignoredPath));
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  private previousTasksForPath(path: string): TaskItem[] {
    return (this.taskIdsByPath.get(path) ?? [])
      .map((taskId) => this.tasksById.get(taskId))
      .filter((task): task is TaskItem => Boolean(task));
  }

  private assignStableIds(path: string, tasks: TaskItem[], previousTasks: TaskItem[]): TaskItem[] {
    const overrideStableIds = this.pendingStableIdOverridesByPath.get(path) ?? new Map<string, string>();
    const persistedRecords = this.options.loadPersistedTaskState?.(path) ?? [];
    const candidatePool = buildStableIdCandidates(previousTasks, persistedRecords);
    const matchedStableIds = new Set<string>();
    const tasksWithStableIds: TaskItem[] = [];

    for (const task of tasks) {
      const overrideStableId = overrideStableIds.get(task.id);
      if (overrideStableId) {
        matchedStableIds.add(overrideStableId);
        tasksWithStableIds.push({ ...task, stableId: overrideStableId });
        continue;
      }

      const match = findStableIdCandidate(task, candidatePool, matchedStableIds);
      const stableId = match?.stableId ?? this.createStableId();
      matchedStableIds.add(stableId);
      tasksWithStableIds.push({ ...task, stableId });
    }

    this.pendingStableIdOverridesByPath.delete(path);
    return tasksWithStableIds;
  }

  private persistStableState(path: string, tasks: TaskItem[]): void {
    const nextState = tasks.map<PersistedVaultTaskStableRecord>((task) => ({
      stableId: task.stableId ?? task.id,
      currentId: task.id,
      text: task.text,
      line: task.line,
      heading: task.heading,
      indent: task.indent,
      dueDate: task.dueDate,
      scheduledDate: task.scheduledDate,
      startDate: task.startDate,
      tags: [...task.tags],
      completed: task.completed
    }));
    const previousState = this.options.loadPersistedTaskState?.(path) ?? [];
    if (samePersistedTaskState(previousState, nextState)) return;
    this.options.savePersistedTaskState?.(path, nextState);
    this.persistenceDirty = true;
  }

  private createStableId(): string {
    return this.options.createStableId?.() ?? `vault:th_${Math.random().toString(36).slice(2, 12)}`;
  }
}

type StableIdCandidate = PersistedVaultTaskStableRecord & {
  textKey: string;
  headingKey: string;
  tagKey: string;
};

function buildStableIdCandidates(
  previousTasks: TaskItem[],
  persistedRecords: PersistedVaultTaskStableRecord[]
): StableIdCandidate[] {
  const candidatesByStableId = new Map<string, StableIdCandidate>();

  for (const task of previousTasks) {
    candidatesByStableId.set(task.stableId ?? task.id, stableIdCandidateFromTask(task));
  }

  for (const record of persistedRecords) {
    if (!candidatesByStableId.has(record.stableId)) {
      candidatesByStableId.set(record.stableId, stableIdCandidateFromRecord(record));
    }
  }

  return [...candidatesByStableId.values()];
}

function findStableIdCandidate(
  task: TaskItem,
  candidates: StableIdCandidate[],
  matchedStableIds: ReadonlySet<string>
): StableIdCandidate | undefined {
  const availableCandidates = candidates.filter((candidate) => !matchedStableIds.has(candidate.stableId));
  const exactIdMatch = availableCandidates.find((candidate) => candidate.currentId === task.id);
  if (exactIdMatch) return exactIdMatch;

  const exactSignatureMatches = availableCandidates.filter((candidate) => exactTaskSignature(candidate) === exactTaskSignature(task));
  if (exactSignatureMatches.length === 1) return exactSignatureMatches[0];
  if (exactSignatureMatches.length > 1) return nearestLineCandidate(task.line, exactSignatureMatches);

  const sameTextMatches = availableCandidates.filter((candidate) => softTaskSignature(candidate) === softTaskSignature(task));
  if (sameTextMatches.length === 1) return sameTextMatches[0];
  if (sameTextMatches.length > 1) return nearestLineCandidate(task.line, sameTextMatches);

  const scored = availableCandidates
    .map((candidate) => ({ candidate, score: stableIdCandidateScore(task, candidate) }))
    .sort((left, right) => right.score - left.score || Math.abs(task.line - left.candidate.line) - Math.abs(task.line - right.candidate.line));
  if (scored.length === 0 || scored[0].score < 220) return undefined;
  if (scored.length > 1 && scored[0].score - scored[1].score < 40) return undefined;
  return scored[0].candidate;
}

function stableIdCandidateScore(task: TaskItem, candidate: StableIdCandidate): number {
  const textKey = normalizeTaskText(task.text);
  const headingKey = normalizeTaskText(task.heading);
  const tagKey = [...task.tags].sort().join("\u0001");
  let score = 0;

  if (candidate.textKey === textKey) score += 180;
  if (candidate.headingKey === headingKey) score += 60;
  if (candidate.indent === task.indent) score += 40;
  if (candidate.dueDate === task.dueDate) score += 70;
  if (candidate.scheduledDate === task.scheduledDate) score += 40;
  if (candidate.startDate === task.startDate) score += 40;
  if (candidate.tagKey === tagKey) score += 50;
  if (candidate.completed === task.completed) score += 10;
  if (candidate.line === task.line) score += 45;
  score -= Math.min(Math.abs(candidate.line - task.line), 20) * 4;

  return score;
}

function stableIdCandidateFromTask(task: TaskItem): StableIdCandidate {
  return stableIdCandidateFromRecord({
    stableId: task.stableId ?? task.id,
    currentId: task.id,
    text: task.text,
    line: task.line,
    heading: task.heading,
    indent: task.indent,
    dueDate: task.dueDate,
    scheduledDate: task.scheduledDate,
    startDate: task.startDate,
    tags: task.tags,
    completed: task.completed
  });
}

function stableIdCandidateFromRecord(record: PersistedVaultTaskStableRecord): StableIdCandidate {
  return {
    ...record,
    textKey: normalizeTaskText(record.text),
    headingKey: normalizeTaskText(record.heading),
    tagKey: [...record.tags].sort().join("\u0001")
  };
}

function exactTaskSignature(task: Pick<PersistedVaultTaskStableRecord, "text" | "heading" | "indent" | "dueDate" | "scheduledDate" | "startDate" | "tags"> | StableIdCandidate): string {
  const tags = "tagKey" in task ? task.tagKey : [...task.tags].sort().join("\u0001");
  return [
    normalizeTaskText(task.text),
    normalizeTaskText(task.heading),
    String(task.indent ?? -1),
    task.dueDate ?? "",
    task.scheduledDate ?? "",
    task.startDate ?? "",
    tags
  ].join("\u0002");
}

function softTaskSignature(task: Pick<PersistedVaultTaskStableRecord, "text" | "heading" | "indent" | "dueDate" | "startDate"> | StableIdCandidate): string {
  return [
    normalizeTaskText(task.text),
    normalizeTaskText(task.heading),
    String(task.indent ?? -1),
    task.startDate ?? task.dueDate ?? ""
  ].join("\u0002");
}

function nearestLineCandidate(line: number, candidates: StableIdCandidate[]): StableIdCandidate | undefined {
  return [...candidates].sort((left, right) => Math.abs(left.line - line) - Math.abs(right.line - line))[0];
}

function normalizeTaskText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim().toLowerCase();
}

function samePersistedTaskState(
  left: PersistedVaultTaskStableRecord[],
  right: PersistedVaultTaskStableRecord[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((record, index) => {
    const candidate = right[index];
    return (
      record.stableId === candidate.stableId &&
      record.currentId === candidate.currentId &&
      record.text === candidate.text &&
      record.line === candidate.line &&
      record.heading === candidate.heading &&
      record.indent === candidate.indent &&
      record.dueDate === candidate.dueDate &&
      record.scheduledDate === candidate.scheduledDate &&
      record.startDate === candidate.startDate &&
      record.completed === candidate.completed &&
      record.tags.length === candidate.tags.length &&
      record.tags.every((tag, tagIndex) => tag === candidate.tags[tagIndex])
    );
  });
}
