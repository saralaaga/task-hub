import type { CalendarDropTarget } from "../calendar/calendarDropTarget";
import { toLocalDateKey } from "../calendar/dateBuckets";
import type { CompletionResult } from "../indexing/taskActions";
import { buildTaskNoteKey } from "../taskNotes";
import { taskPlannedDateKey, taskStartDateKey } from "../taskDates";
import type { CalendarCreationTarget, TaskHubSettings, TaskItem } from "../types";
import type { HubNote } from "../hubNotes";

type TaskHubNoteLike = Pick<HubNote, "path" | "title" | "body" | "tags"> &
  Partial<Pick<HubNote, "noteId" | "kind" | "date" | "related" | "createdAt" | "updatedAt">>;

export type TaskHubApiErrorCode =
  | "validation_error"
  | "not_found"
  | "conflict"
  | "capability_disabled"
  | "operation_failed";

export type TaskHubApiError = {
  code: TaskHubApiErrorCode;
  message: string;
  details?: unknown;
};

export type TaskHubApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TaskHubApiError };

export type TaskHubTaskQuery = {
  status?: "open" | "completed" | "all";
  source?: TaskItem["source"];
  date?: string;
  tags?: string[];
  text?: string;
};

export type TaskHubCreateTaskInput = {
  title: string;
  date?: string;
  startMinutes?: number;
  tags?: string[];
  notes?: string;
  recurrence?: string | null;
  target?: CalendarCreationTarget;
};

export type TaskHubCreateNoteInput = {
  date?: string;
  body?: string;
};

export type TaskHubCreateTaskNoteInput = {
  taskStableId: string;
  body?: string;
};

export type TaskHubTaskDto = {
  id: string;
  stableId: string;
  source: TaskItem["source"];
  title: string;
  completed: boolean;
  tags: string[];
  date?: string;
  startDate?: string;
  filePath?: string;
  line?: number;
  externalId?: string;
  externalListId?: string;
  externalSourceName?: string;
};

export type TaskHubNoteDto = {
  path: string;
  noteId?: string;
  kind: string;
  title: string;
  body: string;
  date?: string;
  related: string[];
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type TaskHubCapabilities = {
  version: 1;
  tasks: {
    list: true;
    createVault: true;
    createAppleReminders: boolean;
    createDida: boolean;
    completeVault: true;
    completeAppleReminders: boolean;
    completeDida: boolean;
  };
  notes: {
    list: boolean;
    createDated: boolean;
    createTaskNote: boolean;
  };
};

export type TaskHubApiHost = {
  settings: Pick<TaskHubSettings, "datedNotes" | "taskNotes" | "localApple" | "dida">;
  getTasks(): TaskItem[];
  getHubNotes(): HubNote[];
  getHubNotesForTask(task: TaskItem): HubNote[];
  createTaskForDate(
    calendarTarget: CalendarDropTarget,
    text: string,
    target: CalendarCreationTarget,
    notes?: string,
    alertMinutesBefore?: number | null,
    recurrence?: string | null,
    recurrenceUntil?: string,
    recurrenceStart?: string,
    options?: { onTaskCreated?: (task: TaskItem) => void }
  ): Promise<void>;
  completeTask(task: TaskItem): Promise<CompletionResult>;
  createDatedNote(dateKey: string, body?: string): Promise<TaskHubNoteLike | undefined>;
  createTaskNoteForTask(task: TaskItem, options?: { body?: string; openAfterCreate?: boolean }): Promise<HubNote | undefined>;
  canCreateAppleReminders(): boolean;
  canCreateDidaTasks(): boolean;
  isLocalAppleSupported(): boolean;
};

export class TaskHubApiV1 {
  constructor(private readonly host: TaskHubApiHost) {}

  capabilities(): TaskHubCapabilities {
    return {
      version: 1,
      tasks: {
        list: true,
        createVault: true,
        createAppleReminders: this.host.canCreateAppleReminders(),
        createDida: this.host.canCreateDidaTasks(),
        completeVault: true,
        completeAppleReminders:
          this.host.isLocalAppleSupported() &&
          this.host.settings.localApple.enabled &&
          this.host.settings.localApple.remindersEnabled &&
          this.host.settings.localApple.remindersWritebackEnabled,
        completeDida:
          this.host.settings.dida.enabled &&
          this.host.settings.dida.tasksEnabled &&
          this.host.settings.dida.tasksWritebackEnabled
      },
      notes: {
        list: this.host.settings.datedNotes.enabled,
        createDated: this.host.settings.datedNotes.enabled,
        createTaskNote: this.host.settings.taskNotes.enabled
      }
    };
  }

  listTasks(query: TaskHubTaskQuery = {}): TaskHubApiResult<{ tasks: TaskHubTaskDto[] }> {
    return ok({ tasks: this.host.getTasks().filter((task) => matchesTaskQuery(task, query)).map(taskToDto) });
  }

  getTask(stableId: string): TaskHubApiResult<{ task: TaskHubTaskDto }> {
    const task = this.findTask(stableId);
    if (!task) return fail("not_found", `Task not found: ${stableId}`);
    return ok({ task: taskToDto(task) });
  }

  async createTask(input: TaskHubCreateTaskInput): Promise<TaskHubApiResult<{ task?: TaskHubTaskDto }>> {
    const title = input.title.replace(/\s+/g, " ").trim();
    if (!title) return fail("validation_error", "Task title is required.");
    if (input.date !== undefined && !isDateKey(input.date)) {
      return fail("validation_error", `Invalid task date: ${input.date}`);
    }
    if (input.startMinutes !== undefined && !isValidStartMinutes(input.startMinutes)) {
      return fail("validation_error", `Invalid startMinutes: ${input.startMinutes}`);
    }

    const target = input.target ?? { type: "vault" };
    if (target.type === "apple-reminders" && !this.host.canCreateAppleReminders()) {
      return fail("capability_disabled", "Apple Reminders task creation is disabled.");
    }
    if (target.type === "dida" && !this.host.canCreateDidaTasks()) {
      return fail("capability_disabled", "Dida task creation is disabled.");
    }

    let createdTask: TaskItem | undefined;
    const calendarTarget: CalendarDropTarget = input.date
      ? { dateKey: input.date, ...(input.startMinutes !== undefined ? { startMinutes: input.startMinutes } : {}) }
      : { kind: "unscheduled" };
    await this.host.createTaskForDate(
      calendarTarget,
      withInlineTags(title, input.tags),
      target,
      input.notes,
      undefined,
      input.recurrence,
      undefined,
      undefined,
      { onTaskCreated: (task) => { createdTask = task; } }
    );
    return ok({ task: createdTask ? taskToDto(createdTask) : undefined });
  }

  async completeTask(stableId: string): Promise<TaskHubApiResult<{ status: CompletionResult["status"]; task?: TaskHubTaskDto }>> {
    return this.setTaskCompletion(stableId, true);
  }

  async reopenTask(stableId: string): Promise<TaskHubApiResult<{ status: CompletionResult["status"]; task?: TaskHubTaskDto }>> {
    return this.setTaskCompletion(stableId, false);
  }

  listNotes(): TaskHubApiResult<{ notes: TaskHubNoteDto[] }> {
    if (!this.host.settings.datedNotes.enabled) {
      return fail("capability_disabled", "Task Hub notes are disabled.");
    }
    return ok({ notes: this.host.getHubNotes().map(noteToDto) });
  }

  async createNote(input: TaskHubCreateNoteInput = {}): Promise<TaskHubApiResult<{ note: TaskHubNoteDto }>> {
    const date = input.date ?? toLocalDateKey(new Date());
    return this.createDatedNote({ date, body: input.body });
  }

  async createDatedNote(input: { date: string; body?: string }): Promise<TaskHubApiResult<{ note: TaskHubNoteDto }>> {
    if (!this.host.settings.datedNotes.enabled) {
      return fail("capability_disabled", "Task Hub notes are disabled.");
    }
    if (!isDateKey(input.date)) return fail("validation_error", `Invalid note date: ${input.date}`);
    const note = await this.host.createDatedNote(input.date, input.body);
    if (!note) return fail("operation_failed", "Task Hub did not return a created note.");
    return ok({ note: noteToDto(note) });
  }

  async createTaskNote(input: TaskHubCreateTaskNoteInput): Promise<TaskHubApiResult<{ note: TaskHubNoteDto }>> {
    if (!this.host.settings.taskNotes.enabled) {
      return fail("capability_disabled", "Task notes are disabled.");
    }
    const task = this.findTask(input.taskStableId);
    if (!task) return fail("not_found", `Task not found: ${input.taskStableId}`);
    const note = await this.host.createTaskNoteForTask(task, { body: input.body, openAfterCreate: false });
    if (!note) return fail("operation_failed", "Task Hub did not return a created task note.");
    return ok({ note: noteToDto(note) });
  }

  listTaskNotes(taskStableId: string): TaskHubApiResult<{ notes: TaskHubNoteDto[] }> {
    if (!this.host.settings.taskNotes.enabled) {
      return fail("capability_disabled", "Task notes are disabled.");
    }
    const task = this.findTask(taskStableId);
    if (!task) return fail("not_found", `Task not found: ${taskStableId}`);
    return ok({ notes: this.host.getHubNotesForTask(task).map(noteToDto) });
  }

  private async setTaskCompletion(
    stableId: string,
    completed: boolean
  ): Promise<TaskHubApiResult<{ status: CompletionResult["status"]; task?: TaskHubTaskDto }>> {
    const task = this.findTask(stableId);
    if (!task) return fail("not_found", `Task not found: ${stableId}`);
    if (task.completed === completed) {
      return ok({ status: "already_in_state", task: taskToDto(task) });
    }
    const result = await this.host.completeTask(task);
    if (result.status === "conflict") return fail("conflict", result.message);
    const updatedTask = this.findTask(stableId) ?? task;
    return ok({ status: result.status, task: taskToDto(updatedTask) });
  }

  private findTask(stableId: string): TaskItem | undefined {
    return this.host.getTasks().find((task) => task.stableId === stableId || task.id === stableId);
  }
}

function ok<T>(data: T): TaskHubApiResult<T> {
  return { ok: true, data };
}

function fail<T>(code: TaskHubApiErrorCode, message: string, details?: unknown): TaskHubApiResult<T> {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } };
}

function taskToDto(task: TaskItem): TaskHubTaskDto {
  const date = taskPlannedDateKey(task);
  return {
    id: task.id,
    stableId: task.stableId ?? task.id,
    source: task.source,
    title: task.text,
    completed: task.completed,
    tags: [...task.tags],
    ...(date ? { date } : {}),
    ...(taskStartDateKey(task) ? { startDate: taskStartDateKey(task) } : {}),
    ...(task.source === "vault" ? { filePath: task.filePath, line: task.line } : {}),
    ...(task.externalId ? { externalId: task.externalId } : {}),
    ...(task.externalListId ? { externalListId: task.externalListId } : {}),
    ...(task.externalSourceName ? { externalSourceName: task.externalSourceName } : {})
  };
}

function noteToDto(note: TaskHubNoteLike): TaskHubNoteDto {
  return {
    path: note.path,
    ...(note.noteId ? { noteId: note.noteId } : {}),
    kind: note.kind ?? "manual",
    title: note.title,
    body: note.body,
    ...(note.date ? { date: note.date } : {}),
    related: [...(note.related ?? [])],
    tags: [...note.tags],
    ...(note.createdAt ? { createdAt: note.createdAt } : {}),
    ...(note.updatedAt ? { updatedAt: note.updatedAt } : {})
  };
}

function matchesTaskQuery(task: TaskItem, query: TaskHubTaskQuery): boolean {
  if (query.status === "open" && task.completed) return false;
  if (query.status === "completed" && !task.completed) return false;
  if (query.source && task.source !== query.source) return false;
  if (query.date && taskPlannedDateKey(task) !== query.date) return false;
  const queryTags = (query.tags ?? []).map(normalizeTag);
  if (queryTags.length > 0 && !queryTags.every((tag) => task.tags.includes(tag))) return false;
  if (query.text && !task.text.toLowerCase().includes(query.text.toLowerCase())) return false;
  return true;
}

function withInlineTags(title: string, tags: string[] | undefined): string {
  const normalizedTags = Array.from(new Set((tags ?? []).map(normalizeTag).filter(Boolean)));
  const missingTags = normalizedTags.filter((tag) => !title.split(/\s+/u).includes(tag));
  return [title, ...missingTags].join(" ").trim();
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function isValidStartMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 24 * 60;
}

export function taskHubNoteRelationKeyForTask(task: TaskItem): string {
  return buildTaskNoteKey(task);
}
