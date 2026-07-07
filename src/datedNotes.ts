export type DatedNoteSettings = {
  enabled: boolean;
  folder: string;
  defaultTitleTemplate: string;
  openAfterCreate: boolean;
};

export type DatedNote = {
  path: string;
  noteId?: string;
  date: string;
  title: string;
  body: string;
  bodyStartLine: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type DatedNoteIndexableFile = {
  path: string;
  extension: string;
  stat: {
    ctime: number;
    mtime: number;
    size: number;
  };
};

type DatedNoteIndexOptions = {
  ignoredPaths: string[];
  readFile: (file: DatedNoteIndexableFile) => string | Promise<string>;
  now?: () => Date;
};

type DatedNoteFileState = {
  path: string;
  mtime: number;
  size: number;
  lastIndexedAt: string;
  lastError?: string;
};

const NOTE_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;

export function createDatedNoteContent(input: {
  noteId: string;
  date: string;
  title: string;
  createdAt: string;
  body?: string;
}): string {
  const frontmatter = [
    "---",
    "taskhub-type: note",
    `taskhub-note-id: "${escapeYamlString(input.noteId)}"`,
    `taskhub-date: ${input.date}`,
    `title: "${escapeYamlString(input.title)}"`,
    `taskhub-created: ${input.createdAt}`,
    `taskhub-updated: ${input.createdAt}`,
    "---"
  ].join("\n");
  return `${frontmatter}\n${datedNoteBodyContent(input.body, input.title)}\n`;
}

export function parseDatedNoteFrontmatter(content: string): Omit<DatedNote, "path"> | undefined {
  const frontmatter = extractFrontmatter(content);
  if (frontmatter.status !== "found") return undefined;
  const scalars = parseScalarValues(frontmatter.block);
  const type = unquoteYamlString(scalars["taskhub-type"] ?? scalars.taskHubType);
  const date = unquoteYamlString(scalars["taskhub-date"] ?? scalars.date);
  if (type !== "note" || !isDateKey(date)) return undefined;

  const normalizedBody = normalizeNoteBodyWithStartLine(frontmatter.body, frontmatter.bodyStartLine);
  const title = unquoteYamlString(scalars.title) ?? firstBodyLine(normalizedBody.body) ?? "Untitled note";
  return {
    noteId: unquoteYamlString(scalars["taskhub-note-id"] ?? scalars.noteId),
    date,
    title,
    body: normalizedBody.body,
    bodyStartLine: normalizedBody.bodyStartLine,
    tags: uniqueStrings([...parseYamlArray(frontmatter.block, "tags").map(normalizeTag), ...extractNoteTags(frontmatter.body)]),
    createdAt: unquoteYamlString(scalars["taskhub-created"] ?? scalars.createdAt),
    updatedAt: unquoteYamlString(scalars["taskhub-updated"] ?? scalars.updatedAt)
  };
}

export function datedNoteFileName(title: string, date: string, createdAt: Date): string {
  const time = createdAt.toTimeString().slice(0, 5).replace(":", "");
  return `${date} ${time} - ${safeFileTitle(title, "Note")}.md`;
}

export function normalizeDatedNoteFolder(path: string | undefined, fallback: string): string {
  return normalizeVaultPath((path ?? "").trim() || fallback);
}

export function applyDatedNoteTitleTemplate(template: string | undefined, date: string): string {
  const safeTemplate = (template ?? "").trim() || "YYYY-MM-DD Note";
  return safeTemplate
    .replace(/YYYY-MM-DD/gu, date)
    .replace(/YYYY/gu, date.slice(0, 4))
    .replace(/MM/gu, date.slice(5, 7))
    .replace(/DD/gu, date.slice(8, 10));
}

export function datedNoteTitleFromBody(body: string): string | undefined {
  return body
    .split(/\r?\n/u)
    .map((line) => line.replace(/^#+\s*/u, "").trim())
    .find(Boolean)
    ?.slice(0, 120);
}

export class DatedNoteIndex {
  private readonly notesByPath = new Map<string, DatedNote>();
  private readonly fileStateByPath = new Map<string, DatedNoteFileState>();

  constructor(private readonly options: DatedNoteIndexOptions) {}

  async scanFiles(files: DatedNoteIndexableFile[]): Promise<void> {
    for (const file of files) {
      await this.reindexFile(file);
    }
  }

  async reindexFile(file: DatedNoteIndexableFile): Promise<void> {
    if (file.extension !== "md" || this.isIgnored(file.path)) return;
    const previousState = this.fileStateByPath.get(file.path);
    if (previousState && !previousState.lastError && previousState.mtime === file.stat.mtime && previousState.size === file.stat.size) {
      return;
    }

    try {
      const content = await this.options.readFile(file);
      const parsed = parseDatedNoteFrontmatter(content);
      this.removeFile(file.path);
      if (parsed) {
        this.notesByPath.set(file.path, { path: file.path, ...parsed });
      }
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        lastIndexedAt: this.nowIso()
      });
    } catch (error) {
      this.removeFile(file.path);
      this.fileStateByPath.set(file.path, {
        path: file.path,
        mtime: file.stat.mtime,
        size: file.stat.size,
        lastIndexedAt: this.nowIso(),
        lastError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  removeFile(path: string): void {
    this.notesByPath.delete(path);
    this.fileStateByPath.delete(path);
  }

  getNotes(): DatedNote[] {
    return Array.from(this.notesByPath.values()).sort(compareDatedNotes);
  }

  getNotesForDate(date: string): DatedNote[] {
    return this.getNotes().filter((note) => note.date === date);
  }

  private isIgnored(path: string): boolean {
    return this.options.ignoredPaths.some((ignoredPath) => path.startsWith(ignoredPath));
  }

  private nowIso(): string {
    return (this.options.now?.() ?? new Date()).toISOString();
  }
}

function compareDatedNotes(left: DatedNote, right: DatedNote): number {
  return (
    right.date.localeCompare(left.date) ||
    (right.createdAt ?? "").localeCompare(left.createdAt ?? "") ||
    right.path.localeCompare(left.path)
  );
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

function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//u, "").replace(/^\/+/u, "").replace(/\/$/u, "");
}

function safeFileTitle(title: string, fallback: string): string {
  const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (safe || fallback).slice(0, 80);
}

function datedNoteBodyContent(body: string | undefined, title: string): string {
  const trimmedBody = (body ?? "").trim();
  return trimmedBody || `# ${title}\n`;
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

function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}
