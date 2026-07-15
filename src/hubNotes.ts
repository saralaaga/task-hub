import { formatThinoCompatibleTimestamp, thinoIdFromIso } from "./thinoMetadata";

export type HubNoteSourceKind = "task-note" | "dated-note" | "hybrid";
export type HubNoteKind = "manual" | "task-related" | "transcript" | "imported" | (string & {});

export const DEFAULT_HUB_NOTE_KIND: HubNoteKind = "manual";
export const HUB_NOTE_ID_PREFIX = "thn_";
export const HUB_NOTE_ID_PATTERN = /^thn_\d{14}_[a-z0-9]{4}$/u;

export type HubNote = {
  path: string;
  noteId?: string;
  kind: HubNoteKind;
  title: string;
  body: string;
  bodyStartLine: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  related: string[];
  history: string[];
  sourceKind: HubNoteSourceKind;
};

export type TimelineHubNote = HubNote & {
  date: string;
  dateDerived: boolean;
};

export type HubNoteCreateInput = {
  noteId: string;
  kind?: HubNoteKind;
  title: string;
  createdAt: string;
  body?: string;
  date?: string;
  relatedKeys?: string[];
  historyKeys?: string[];
  mode?: "task-hub" | "thino-multi-file";
  addThinoIdToTaskHubNotes?: boolean;
};

export type HubNoteUpdateResult =
  | { status: "updated"; content: string }
  | { status: "conflict"; message: string };

export type HubNoteIndexableFile = {
  path: string;
  extension: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
};

type HubNoteIndexOptions = {
  ignoredPaths: string[];
  readFile: (file: HubNoteIndexableFile) => string | Promise<string>;
  now?: () => Date;
};

type HubNoteFileState = {
  path: string;
  mtime: number;
  size: number;
  related: string[];
  timelineDate?: string;
  lastIndexedAt: string;
  lastError?: string;
};

const NOTE_TAG = /(^|[^0-9A-Za-z_/-])(#[\p{L}\p{N}_/-]+)/gu;
export const HUB_NOTE_UNDATED_DATE = "__task-hub-undated__";

export function createHubNoteId(createdAt: Date, randomSuffix = Math.random().toString(36).slice(2, 6)): string {
  const timestamp = createdAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const normalizedSuffix = normalizeHubNoteIdSuffix(randomSuffix);
  return `${HUB_NOTE_ID_PREFIX}${timestamp}_${normalizedSuffix}`;
}

export function parseHubNoteFrontmatter(content: string, path = ""): Omit<HubNote, "path"> | undefined {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status !== "found") return undefined;
  const scalars = parseScalarValues(frontmatter.block);
  const related = parseYamlArray(frontmatter.block, "taskhub-related");
  const history = parseYamlArray(frontmatter.block, "taskhub-related-history");
  const rawDate = unquoteYamlString(scalars["taskhub-date"] ?? scalars.date);
  const date = isDateKey(rawDate) ? rawDate : undefined;
  const hasDatedNote = unquoteYamlString(scalars["taskhub-type"] ?? scalars.taskHubType) === "note" || Boolean(date);
  const hasTaskNote = related.length > 0 || history.length > 0 || (scalars["taskhub-note"] === "true" && !hasDatedNote);
  if (!hasTaskNote && !hasDatedNote) return undefined;
  const kind = resolveHubNoteKind(unquoteYamlString(scalars["taskhub-kind"] ?? scalars.taskHubKind), { related, history });

  const normalizedBody = normalizeNoteBodyWithStartLine(frontmatter.body, frontmatter.bodyStartLine);
  return {
    noteId: unquoteYamlString(scalars["taskhub-note-id"] ?? scalars.noteId),
    kind,
    title: unquoteYamlString(scalars.title) ?? firstBodyLine(normalizedBody.body) ?? titleFromPath(path),
    body: normalizedBody.body,
    bodyStartLine: normalizedBody.bodyStartLine,
    tags: uniqueStrings([
      ...parseYamlArray(frontmatter.block, "tags").map(normalizeTag),
      ...extractNoteTags(frontmatter.body)
    ]),
    createdAt: unquoteYamlString(scalars["taskhub-created"] ?? scalars.createdAt),
    updatedAt: unquoteYamlString(scalars["taskhub-updated"] ?? scalars.updatedAt),
    date,
    related,
    history,
    sourceKind: hasTaskNote && hasDatedNote ? "hybrid" : hasTaskNote ? "task-note" : "dated-note"
  };
}

export function timelineDateForHubNote(note: HubNote): string | undefined {
  if (note.kind === "task-related") {
    const createdDate = isoDateKey(note.createdAt);
    if (createdDate) return createdDate;
    const updatedDate = isoDateKey(note.updatedAt);
    if (updatedDate) return updatedDate;
    return note.date && isDateKey(note.date) ? note.date : undefined;
  }
  if (note.date && isDateKey(note.date)) return note.date;
  const createdDate = isoDateKey(note.createdAt);
  if (createdDate) return createdDate;
  const updatedDate = isoDateKey(note.updatedAt);
  if (updatedDate) return updatedDate;
  return undefined;
}

export function toTimelineHubNote(note: HubNote): TimelineHubNote {
  const timelineDate = timelineDateForHubNote(note) ?? HUB_NOTE_UNDATED_DATE;
  return {
    ...note,
    date: timelineDate,
    dateDerived: timelineDate !== note.date
  };
}

export function createHubNoteContent(input: HubNoteCreateInput): string {
  const includeThinoMetadata = input.mode === "thino-multi-file" || input.addThinoIdToTaskHubNotes;
  const relatedKeys = uniqueStrings(input.relatedKeys ?? []);
  const historyKeys = uniqueStrings(input.historyKeys ?? []);
  const kind = resolveHubNoteKind(input.kind, { related: relatedKeys, history: historyKeys });
  const nextBody = normalizeHubNoteBody(input.body ?? "");
  const nextTitle = normalizeHubNoteTitle(input.title, nextBody);
  const thinoTimestamp = formatThinoCompatibleTimestamp(input.createdAt);
  const frontmatter = [
    "---",
    ...(includeThinoMetadata
      ? [`id: "${thinoIdFromIso(input.createdAt)}"`, `createdAt: ${thinoTimestamp}`, `updatedAt: ${thinoTimestamp}`]
      : []),
    "taskhub-note: true",
    `taskhub-note-id: "${escapeYamlString(input.noteId)}"`,
    `taskhub-kind: "${escapeYamlString(kind)}"`,
    `title: "${escapeYamlString(nextTitle)}"`,
    ...(input.date ? ["taskhub-type: note", `taskhub-date: ${input.date}`] : []),
    ...(relatedKeys.length > 0 ? ["taskhub-related:", ...relatedKeys.map((key) => `  - "${escapeYamlString(key)}"`)] : []),
    ...(historyKeys.length > 0
      ? ["taskhub-related-history:", ...historyKeys.map((key) => `  - "${escapeYamlString(key)}"`)]
      : []),
    `taskhub-created: ${input.createdAt}`,
    `taskhub-updated: ${input.createdAt}`,
    "tags:",
    "  - task-hub-note",
    "---"
  ].join("\n");
  return nextBody ? `${frontmatter}\n${nextBody}\n` : `${frontmatter}\n`;
}

export function replaceHubNoteBody(content: string, body: string, updatedAt: string): HubNoteUpdateResult {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status === "malformed") {
    return { status: "conflict", message: "Malformed YAML frontmatter." };
  }
  if (frontmatter.status !== "found") {
    return { status: "conflict", message: "Task Hub note frontmatter is missing." };
  }

  const scalars = parseScalarValues(frontmatter.block);
  const nextBody = normalizeHubNoteBody(body);
  const shouldUpdateTitle =
    "title" in scalars ||
    Boolean(unquoteYamlString(scalars["taskhub-date"] ?? scalars.date)) ||
    unquoteYamlString(scalars["taskhub-type"] ?? scalars.taskHubType) === "note";
  const nextTitle = normalizeHubNoteTitle(firstBodyLine(nextBody) ?? unquoteYamlString(scalars.title) ?? "Untitled note", nextBody);
  const thinoUpdatedAt = formatThinoCompatibleTimestamp(updatedAt);
  const nextBlock = updateScalarValues(frontmatter.block, {
    ...(scalars.createdAt !== undefined ? { createdAt: formatThinoCompatibleTimestamp(scalars.createdAt) } : {}),
    ...(shouldUpdateTitle ? { title: `"${escapeYamlString(nextTitle)}"` } : {}),
    ...(scalars.updatedAt !== undefined ? { updatedAt: thinoUpdatedAt } : {}),
    "taskhub-updated": updatedAt
  });
  return { status: "updated", content: `---\n${nextBlock}\n---\n${nextBody ? `${nextBody}\n` : ""}` };
}

export function toggleHubNoteTaskCheckbox(
  content: string,
  input: { sourceLine: number; rawLine: string; checked: boolean; updatedAt: string }
): HubNoteUpdateResult {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status === "malformed") {
    return { status: "conflict", message: "Malformed YAML frontmatter." };
  }
  if (frontmatter.status !== "found") {
    return { status: "conflict", message: "Task Hub note frontmatter is missing." };
  }

  const normalizedBody = normalizeNoteBodyWithStartLine(frontmatter.body, frontmatter.bodyStartLine);
  const bodyLineIndex = input.sourceLine - normalizedBody.bodyStartLine;
  const bodyLines = normalizedBody.body.split(/\r?\n/u);
  const currentLine = bodyLines[bodyLineIndex];
  if (bodyLineIndex < 0 || bodyLineIndex >= bodyLines.length || currentLine === undefined) {
    return { status: "conflict", message: "Task checkbox line is outside the note body." };
  }
  if (normalizeTaskCheckboxLine(currentLine) !== normalizeTaskCheckboxLine(input.rawLine)) {
    return { status: "conflict", message: "Task checkbox line no longer matches the note." };
  }
  const nextLine = setTaskCheckboxState(currentLine, input.checked);
  if (!nextLine) {
    return { status: "conflict", message: "Task checkbox line is no longer a checkbox." };
  }
  bodyLines[bodyLineIndex] = nextLine;
  return replaceHubNoteBody(content, bodyLines.join("\n"), input.updatedAt);
}

export class HubNoteIndex {
  private readonly notesByPath = new Map<string, HubNote>();
  private readonly notePathsByKey = new Map<string, string[]>();
  private readonly notePathsByDate = new Map<string, string[]>();
  private readonly fileStateByPath = new Map<string, HubNoteFileState>();

  constructor(private readonly options: HubNoteIndexOptions) {}

  async scanFiles(files: HubNoteIndexableFile[]): Promise<void> {
    for (const file of files) {
      await this.reindexFile(file);
    }
  }

  async reindexFile(file: HubNoteIndexableFile): Promise<void> {
    if (file.extension !== "md" || this.isIgnored(file.path)) return;
    const previousState = this.fileStateByPath.get(file.path);
    if (previousState && !previousState.lastError && previousState.mtime === file.stat.mtime && previousState.size === file.stat.size) {
      return;
    }

    try {
      const content = await this.options.readFile(file);
      const parsed = parseHubNoteFrontmatter(content, file.path);
      this.removeFile(file.path);
      if (parsed) {
        const note: HubNote = { path: file.path, ...parsed };
        this.notesByPath.set(file.path, note);
        for (const key of note.related) {
          this.notePathsByKey.set(key, [...(this.notePathsByKey.get(key) ?? []), file.path]);
        }
        const timelineDate = timelineDateForHubNote(note) ?? HUB_NOTE_UNDATED_DATE;
        this.notePathsByDate.set(timelineDate, [...(this.notePathsByDate.get(timelineDate) ?? []), file.path]);
      }
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        related: parsed?.related ?? [],
        timelineDate: parsed ? timelineDateForHubNote({ path: file.path, ...parsed }) ?? HUB_NOTE_UNDATED_DATE : undefined,
        lastIndexedAt: this.nowIso()
      });
    } catch (error) {
      this.removeFile(file.path);
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        related: [],
        timelineDate: undefined,
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
      const timelineDate = timelineDateForHubNote(previous) ?? HUB_NOTE_UNDATED_DATE;
      this.notePathsByDate.set(timelineDate, (this.notePathsByDate.get(timelineDate) ?? []).filter((notePath) => notePath !== path));
    }
    this.notesByPath.delete(path);
    this.fileStateByPath.delete(path);
  }

  getNote(path: string): HubNote | undefined {
    return this.notesByPath.get(path);
  }

  getNotes(): HubNote[] {
    return Array.from(this.notesByPath.values()).sort(compareHubNotes);
  }

  getTimelineNotes(): TimelineHubNote[] {
    return this.getNotes().map(toTimelineHubNote);
  }

  getNotesForDate(date: string): TimelineHubNote[] {
    return (this.notePathsByDate.get(date) ?? [])
      .map((path) => this.notesByPath.get(path))
      .filter(isHubNote)
      .map(toTimelineHubNote)
      .sort(compareTimelineHubNotes);
  }

  getNotesForKey(key: string): HubNote[] {
    return (this.notePathsByKey.get(key) ?? [])
      .map((path) => this.notesByPath.get(path))
      .filter(isHubNote)
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "") || right.path.localeCompare(left.path));
  }

  private isIgnored(path: string): boolean {
    return this.options.ignoredPaths.some((ignoredPath) => path.startsWith(ignoredPath));
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}

function compareHubNotes(left: HubNote, right: HubNote): number {
  return compareTimelineHubNotes(toTimelineHubNote(left), toTimelineHubNote(right));
}

function compareTimelineHubNotes(left: TimelineHubNote, right: TimelineHubNote): number {
  if (left.date === right.date) {
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "") || right.path.localeCompare(left.path);
  }
  if (left.date === HUB_NOTE_UNDATED_DATE) return 1;
  if (right.date === HUB_NOTE_UNDATED_DATE) return -1;
  return right.date.localeCompare(left.date) || (right.createdAt ?? "").localeCompare(left.createdAt ?? "") || right.path.localeCompare(left.path);
}

function compareTimelineDateKey(left: string, right: string): number {
  if (left === right) return 0;
  if (left === HUB_NOTE_UNDATED_DATE) return 1;
  if (right === HUB_NOTE_UNDATED_DATE) return -1;
  return left.localeCompare(right);
}

function isHubNote(value: HubNote | undefined): value is HubNote {
  return value !== undefined;
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

function resolveHubNoteKind(kind: string | undefined, relations: { related: string[]; history: string[] }): HubNoteKind {
  const normalizedKind = normalizeHubNoteKind(kind);
  if (normalizedKind) return normalizedKind;
  if (relations.related.length > 0 || relations.history.length > 0) return "task-related";
  return DEFAULT_HUB_NOTE_KIND;
}

function normalizeHubNoteKind(kind: string | undefined): HubNoteKind | undefined {
  const normalized = (kind ?? "").trim();
  return normalized ? (normalized as HubNoteKind) : undefined;
}

function normalizeHubNoteIdSuffix(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/gu, "").slice(0, 4);
  return normalized.padEnd(4, "0");
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

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function updateScalarValues(block: string, updates: Record<string, string>): string {
  const lines = block.split(/\r?\n/u);
  const seen = new Set<string>();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!match) return line;
    const key = match[1];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}: ${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}: ${value}`);
    }
  }
  return nextLines.join("\n");
}

function normalizeTag(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function normalizeHubNoteBody(body: string): string {
  return body.replace(/\s+$/u, "");
}

function normalizeTaskCheckboxLine(line: string): string {
  return line.replace(/^(\s*[-*]\s+\[)[ xX](\]\s*)/u, "$1 $2");
}

function setTaskCheckboxState(line: string, checked: boolean): string | undefined {
  const match = line.match(/^(\s*[-*]\s+\[)[ xX](\]\s*.*)$/u);
  if (!match) return undefined;
  return `${match[1]}${checked ? "x" : " "}${match[2]}`;
}

function normalizeHubNoteTitle(title: string, body: string): string {
  return title.trim() || firstBodyLine(body) || "Untitled note";
}

function extractNoteTags(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(NOTE_TAG), (match) => match[2])));
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

function titleFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/iu, "") ?? path;
}

function isoDateKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const rawValue: string = value;
  if (isDateKey(rawValue)) return rawValue;
  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0")
    ].join("-");
  }
  const maybeDate = rawValue.slice(0, 10);
  return isDateKey(maybeDate) ? maybeDate : undefined;
}

function isDateKey(value: string | undefined): boolean {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}
