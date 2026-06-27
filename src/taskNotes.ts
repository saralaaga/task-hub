import type { CalendarEvent, TaskItem } from "./types";

export type TaskNoteMode = "task-hub" | "thino-multi-file";

export type TaskNoteSettings = {
  enabled: boolean;
  notesFolder: string;
  defaultMode: TaskNoteMode;
  thinoIntegrationEnabled: boolean;
  thinoFolder: string;
  openNoteAfterCreate: boolean;
  showCountsInTaskList: boolean;
  showFrontmatterInNoteModal: boolean;
  linkedNoteSubtasksEnabled: boolean;
};

export type TaskNote = {
  path: string;
  noteId?: string;
  related: string[];
  history: string[];
  title: string;
  body: string;
  bodyStartLine: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type TaskNoteFrontmatter = {
  noteId?: string;
  related: string[];
  history: string[];
  body: string;
  bodyStartLine: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type TaskNoteUpdateResult =
  | { status: "updated"; content: string }
  | { status: "conflict"; message: string };

export type TaskNoteFrontmatterUpdate = {
  noteId?: string;
  relatedKeys: string[];
  historyKeys?: string[];
  createdAt?: string;
  updatedAt: string;
};

export type TaskNoteTransfer = {
  fromKey: string;
  toKey: string;
  updatedAt: string;
};

export type NoteIndexableFile = {
  path: string;
  extension: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
};

type TaskNoteIndexOptions = {
  ignoredPaths: string[];
  readFile: (file: NoteIndexableFile) => string | Promise<string>;
  now?: () => Date;
};

type NoteFileState = {
  path: string;
  mtime: number;
  size: number;
  related: string[];
  lastIndexedAt: string;
  lastError?: string;
};

const MANAGED_KEYS = new Set([
  "taskhub-note",
  "taskhub-note-id",
  "taskhub-related",
  "taskhub-related-history",
  "taskhub-created",
  "taskhub-updated"
]);
const NOTE_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;

export function buildTaskNoteKey(task: TaskItem): string {
  if (task.source !== "vault" && task.externalId) {
    return `task:${task.source}:${task.externalId}`;
  }
  return `task:${task.source}:${task.filePath}:${task.line}:${hashText(task.rawLine || task.id)}`;
}

export function buildCalendarEventNoteKey(event: CalendarEvent): string {
  return `event:${event.sourceId}:${event.id}:${event.start.slice(0, 10)}`;
}

export function createTaskNoteContent(input: {
  noteId: string;
  relatedKey: string;
  title: string;
  createdAt: string;
  mode?: TaskNoteMode;
}): string {
  const frontmatter = [
    "---",
    ...(input.mode === "thino-multi-file"
      ? [`id: "${thinoIdFromIso(input.createdAt)}"`, `createdAt: ${input.createdAt}`, `updatedAt: ${input.createdAt}`]
      : []),
    "taskhub-note: true",
    `taskhub-note-id: "${escapeYamlString(input.noteId)}"`,
    "taskhub-related:",
    `  - "${escapeYamlString(input.relatedKey)}"`,
    `taskhub-created: ${input.createdAt}`,
    `taskhub-updated: ${input.createdAt}`,
    "tags:",
    "  - task-hub-note",
    "---"
  ].join("\n");
  return `${frontmatter}\n`;
}

export function parseTaskNoteFrontmatter(content: string): TaskNoteFrontmatter | undefined {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status !== "found") return undefined;
  const scalars = parseScalarValues(frontmatter.block);
  const related = parseYamlArray(frontmatter.block, "taskhub-related");
  const history = parseYamlArray(frontmatter.block, "taskhub-related-history");
  const isTaskHubNote = scalars["taskhub-note"] === "true" || related.length > 0;
  if (!isTaskHubNote) return undefined;
  const normalizedBody = normalizeNoteBodyWithStartLine(frontmatter.body, frontmatter.bodyStartLine);
  return {
    noteId: unquoteYamlString(scalars["taskhub-note-id"]),
    related,
    history,
    body: normalizedBody.body,
    bodyStartLine: normalizedBody.bodyStartLine,
    tags: extractNoteTags(frontmatter.body),
    createdAt: scalars["taskhub-created"],
    updatedAt: scalars["taskhub-updated"]
  };
}

export function updateTaskNoteFrontmatter(content: string, update: TaskNoteFrontmatterUpdate): TaskNoteUpdateResult {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status === "malformed") {
    return { status: "conflict", message: "Malformed YAML frontmatter." };
  }

  const existingBlock = frontmatter.status === "found" ? frontmatter.block : "";
  const scalars = parseScalarValues(existingBlock);
  const relatedKeys = uniqueStrings(update.relatedKeys);
  const historyKeys = uniqueStrings(update.historyKeys ?? parseYamlArray(existingBlock, "taskhub-related-history"));
  const noteId = update.noteId ?? unquoteYamlString(scalars["taskhub-note-id"]);
  const createdAt = update.createdAt ?? scalars["taskhub-created"];
  const unmanaged = stripManagedFrontmatterLines(existingBlock);
  const managed = buildManagedTaskNoteLines({
    noteId,
    relatedKeys,
    historyKeys,
    createdAt,
    updatedAt: update.updatedAt
  });
  const block = [...unmanaged, ...managed].join("\n");
  const wrapped = `---\n${block}\n---`;
  const body = frontmatter.status === "found" ? frontmatter.body : content;
  return { status: "updated", content: body ? `${wrapped}\n${body.replace(/^\n/u, "")}` : `${wrapped}\n` };
}

export function transferTaskNoteRelationship(content: string, transfer: TaskNoteTransfer): TaskNoteUpdateResult {
  const parsed = parseTaskNoteFrontmatter(content);
  if (!parsed) {
    return { status: "conflict", message: "Task note metadata not found." };
  }
  const related = parsed.related.filter((key) => key !== transfer.fromKey);
  if (!related.includes(transfer.toKey)) related.push(transfer.toKey);
  const history = uniqueStrings([...parsed.history, transfer.fromKey]);
  return updateTaskNoteFrontmatter(content, {
    noteId: parsed.noteId,
    relatedKeys: related,
    historyKeys: history,
    createdAt: parsed.createdAt,
    updatedAt: transfer.updatedAt
  });
}

export function replaceTaskNoteBody(content: string, body: string): TaskNoteUpdateResult {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status === "malformed") {
    return { status: "conflict", message: "Malformed YAML frontmatter." };
  }
  const nextBody = body.replace(/\s+$/u, "");
  if (frontmatter.status === "found") {
    return { status: "updated", content: `---\n${frontmatter.block}\n---\n${nextBody ? `${nextBody}\n` : ""}` };
  }
  return { status: "updated", content: nextBody ? `${nextBody}\n` : "" };
}

export function taskNoteFileName(title: string, createdAt: Date, mode: TaskNoteMode): string {
  if (mode === "thino-multi-file") return `${thinoIdFromIso(createdAt.toISOString())}.md`;
  const date = createdAt.toISOString().slice(0, 10);
  const time = createdAt.toTimeString().slice(0, 5).replace(":", "");
  return `${date} ${time} - ${safeFileTitle(title)}.md`;
}

export function normalizeTaskNoteFolder(path: string | undefined, fallback: string): string {
  return normalizeVaultPath((path ?? "").trim() || fallback);
}

export class TaskNoteIndex {
  private readonly notesByPath = new Map<string, TaskNote>();
  private readonly notePathsByKey = new Map<string, string[]>();
  private readonly fileStateByPath = new Map<string, NoteFileState>();

  constructor(private readonly options: TaskNoteIndexOptions) {}

  async scanFiles(files: NoteIndexableFile[]): Promise<void> {
    for (const file of files) {
      await this.reindexFile(file);
    }
  }

  async reindexFile(file: NoteIndexableFile): Promise<void> {
    if (file.extension !== "md" || this.isIgnored(file.path)) return;
    const previousState = this.fileStateByPath.get(file.path);
    if (previousState && !previousState.lastError && previousState.mtime === file.stat.mtime && previousState.size === file.stat.size) {
      return;
    }

    try {
      const content = await this.options.readFile(file);
      const parsed = parseTaskNoteFrontmatter(content);
      this.removeFile(file.path);
      if (parsed) {
        const note: TaskNote = {
          path: file.path,
          noteId: parsed.noteId,
          related: parsed.related,
          history: parsed.history,
          title: firstBodyLine(parsed.body) ?? titleFromPath(file.path),
          body: parsed.body,
          bodyStartLine: parsed.bodyStartLine,
          tags: parsed.tags,
          createdAt: parsed.createdAt,
          updatedAt: parsed.updatedAt
        };
        this.notesByPath.set(file.path, note);
        for (const key of parsed.related) {
          this.notePathsByKey.set(key, [...(this.notePathsByKey.get(key) ?? []), file.path]);
        }
      }
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        related: parsed?.related ?? [],
        lastIndexedAt: this.nowIso()
      });
    } catch (error) {
      this.removeFile(file.path);
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        related: [],
        lastIndexedAt: this.nowIso(),
        lastError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  removeFile(path: string): void {
    const previous = this.notesByPath.get(path);
    if (previous) {
      for (const key of previous.related) {
        this.notePathsByKey.set(key, (this.notePathsByKey.get(key) ?? []).filter((notePath) => notePath !== path));
      }
    }
    this.notesByPath.delete(path);
    this.fileStateByPath.delete(path);
  }

  getNotesForKey(key: string): TaskNote[] {
    return (this.notePathsByKey.get(key) ?? []).map((path) => this.notesByPath.get(path)).filter(isTaskNote).sort(
      (left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "") || right.path.localeCompare(left.path)
    );
  }

  getNoteCountForKey(key: string): number {
    return this.getNotesForKey(key).length;
  }

  private isIgnored(path: string): boolean {
    return this.options.ignoredPaths.some((ignoredPath) => path.startsWith(ignoredPath));
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}

function isTaskNote(value: TaskNote | undefined): value is TaskNote {
  return value !== undefined;
}

function buildManagedTaskNoteLines(input: {
  noteId?: string;
  relatedKeys: string[];
  historyKeys: string[];
  createdAt?: string;
  updatedAt: string;
}): string[] {
  return [
    "taskhub-note: true",
    ...(input.noteId ? [`taskhub-note-id: "${escapeYamlString(input.noteId)}"`] : []),
    "taskhub-related:",
    ...input.relatedKeys.map((key) => `  - "${escapeYamlString(key)}"`),
    ...(input.historyKeys.length > 0
      ? ["taskhub-related-history:", ...input.historyKeys.map((key) => `  - "${escapeYamlString(key)}"`)]
      : []),
    ...(input.createdAt ? [`taskhub-created: ${input.createdAt}`] : []),
    `taskhub-updated: ${input.updatedAt}`
  ];
}

function stripManagedFrontmatterLines(block: string): string[] {
  const lines = block.split(/\r?\n/u);
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const key = lines[index].match(/^([A-Za-z0-9_-]+):/u)?.[1];
    if (key && MANAGED_KEYS.has(key)) {
      while (index + 1 < lines.length && /^\s+-\s/u.test(lines[index + 1])) {
        index += 1;
      }
      continue;
    }
    if (lines[index].trim()) kept.push(lines[index]);
  }
  return kept;
}

function extractFrontmatter(content: string):
  | { status: "none" }
  | { status: "malformed" }
  | { status: "found"; block: string; body: string; bodyStartLine: number } {
  if (!content.startsWith("---")) return { status: "none" };
  const lines = content.split(/\r?\n/u);
  if (lines[0].trim() !== "---") return { status: "none" };
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return {
        status: "found",
        block: lines.slice(1, index).join("\n"),
        body: lines.slice(index + 1).join("\n"),
        bodyStartLine: index + 1
      };
    }
  }
  return { status: "malformed" };
}

function parseScalarValues(block: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (match && !match[2].startsWith("|") && match[2] !== "") {
      values[match[1]] = match[2].trim();
    }
  }
  return values;
}

function parseYamlArray(block: string, key: string): string[] {
  const lines = block.split(/\r?\n/u);
  const values: string[] = [];
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return values;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s+-\s*(.*)$/u);
    if (!match) break;
    values.push(unquoteYamlString(match[1]) ?? match[1]);
  }
  return uniqueStrings(values);
}

function hashText(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function unquoteYamlString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function thinoIdFromIso(value: string): string {
  return value.replace(/[-:TZ.]/g, "").slice(0, 14);
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//u, "").replace(/^\/+/u, "").replace(/\/$/u, "");
}

function safeFileTitle(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (safe || "Task note").slice(0, 80);
}

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function normalizeNoteBody(body: string): string {
  return body.replace(/^\s*\n/u, "").replace(/\s+$/u, "");
}

function normalizeNoteBodyWithStartLine(body: string, bodyStartLine: number): { body: string; bodyStartLine: number } {
  const withoutTrailingWhitespace = body.replace(/\s+$/u, "");
  const leadingBlankLines = withoutTrailingWhitespace.match(/^([ \t]*\r?\n)+/u)?.[0] ?? "";
  return {
    body: withoutTrailingWhitespace.slice(leadingBlankLines.length),
    bodyStartLine: bodyStartLine + leadingBlankLines.split(/\r?\n/u).length - 1
  };
}

function firstBodyLine(body: string): string | undefined {
  return body
    .split(/\r?\n/u)
    .map((line) => line.replace(/^#+\s*/u, "").trim())
    .find(Boolean);
}

function extractNoteTags(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(NOTE_TAG), (match) => match[2])));
}
