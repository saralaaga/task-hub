import { ButtonComponent, Editor, EventRef, MarkdownView, Menu, Modal, Notice, Platform, Plugin, requestUrl, Setting, TFile, WorkspaceLeaf } from "obsidian";
import { type Extension, Transaction } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { PLUGIN_DISPLAY_NAME, TASK_HUB_VIEW_TYPE } from "./constants";
import { appleCalendarEventToReminderInput, appleReminderToCalendarEventInput } from "./calendar/appleConversion";
import { calendarDropTargetParts, isUnscheduledCalendarDropTarget, withCalendarDropTargetDate, type CalendarDropTarget } from "./calendar/calendarDropTarget";
import { toLocalDateKey } from "./calendar/dateBuckets";
import { extractAppleReminderTitleTags, normalizeAppleReminderTags } from "./appleReminderTags";
import { fetchIcsSource } from "./calendar/icsClient";
import { DidaClient } from "./dida/didaClient";
import { DIDA_INBOX_PROJECT_NAME, didaProjectsFromRecords, didaSource, didaTaskToTaskItem, taskItemToDidaPayload } from "./dida/didaMapping";
import { extractDidaTitleTags } from "./dida/didaTags";
import { createTranslator } from "./i18n";
import { registerTaskHubIcon, TASK_HUB_ICON_ID } from "./icons";
import { applySmartListToTasks } from "./filtering/smartLists";
import {
  canCreateAppleRemindersCapability,
  canCreateDidaTasksCapability,
  canDeleteAppleCalendarEventCapability,
  canDeleteAppleReminderCapability
} from "./integrationCapabilities";
import { parseTaskAtLine } from "./indexing/editorTask";
import { completeTaskInContent, deleteTaskInContent, rescheduleTaskInContent, unscheduleTaskInContent, updateTaskLineInContent, type CompletionResult, type RescheduleMessages } from "./indexing/taskActions";
import { TaskIndex } from "./indexing/taskIndex";
import { openExternalTaskSource } from "./externalSources";
import { appendTaskToContent, createTaskLine, normalizeTaskCreationFilePath } from "./taskCreation";
import { isDateKeyWithinWindow, taskPlannedDateKey, taskStartDateForRepair, taskStartDateKey, taskWindowDateKey } from "./taskDates";
import { bindTaskHubTagInputSuggest, collectObsidianTags } from "./views/tagInputSuggest";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "./reminderAlerts";
import { preferredTaskSendTarget, taskSendTargetOptions } from "./taskSendTargets";
import { cleanupTaskListManualOrder, reorderTaskListDate, sortTasksForTaskList, taskListDateKey, type TaskListDropPosition } from "./taskListOrdering";
import { snapDayStartMinutes } from "./timeGranularity";
import { recurrenceDatesBetween } from "./recurrence";
import {
  TaskNoteIndex,
  buildCalendarEventNoteKey,
  buildTaskNoteKey,
  normalizeTaskNoteFolder,
  taskNoteFileName,
  transferTaskNoteRelationship,
  type TaskNote
} from "./taskNotes";
import {
  DatedNoteIndex,
  applyDatedNoteTitleTemplate,
  datedNoteFileName,
  datedNoteTitleFromBody,
  normalizeDatedNoteFolder,
  type DatedNote
} from "./datedNotes";
import {
  HubNoteIndex,
  createHubNoteId,
  createHubNoteContent,
  replaceHubNoteBody,
  type HubNote,
  type HubNoteIndexableFile,
  type TimelineHubNote
} from "./hubNotes";
import {
  cleanupTaskNotePinnedEntry,
  cleanupTaskNoteManualOrderEntry,
  prioritizeTaskNoteInManualOrder,
  reorderTaskNotes as buildReorderedTaskNoteKeys,
  sortTaskNotes,
  taskNoteOrderItemKey,
  taskNoteOrderScopeKey,
  togglePinnedTaskNote
} from "./taskNoteOrdering";
import {
  appleCalendarSource,
  appleCalendarsFromEvents,
  appleRemindersSource,
  configureLocalAppleHelperPath,
  createAppleReminder,
  createAppleCalendarEvent,
  deleteAppleCalendarEvent,
  deleteAppleReminder,
  getLocalAppleHelperStatus,
  installBundledAppleHelper,
  readAppleCalendarLists,
  readAppleCalendarEventsData,
  readAppleReminderLists,
  readAppleRemindersData,
  requestLocalAppleAccess,
  setAppleCalendarEventDate,
  setAppleCalendarEventDetails,
  setAppleReminderCompleted,
  setAppleReminderDetails,
  setAppleReminderDueDate,
  setAppleReminderList,
  type AppleHelperErrorCode,
  type AppleHelperStatus
} from "./localApple";
import {
  DEFAULT_SETTINGS,
  creationTargetLabel,
  normalizeTaskHubSettings,
  parseCreationKind,
  parseCreationTarget,
  populateCreationKindDropdown,
  populateEventCreationTargetDropdown,
  populateTaskCreationTargetDropdown,
  serializeCreationTarget,
  TaskHubSettingTab
} from "./settings";
import type {
  AppleCalendarInfo,
  CalendarCreationKind,
  CalendarCreationTarget,
  CalendarEvent,
  CalendarItemEditDraft,
  CalendarSourceStatus,
  LocalAppleSyncStatus,
  TaskHubSettings,
  TaskItem,
  TaskSendTarget
} from "./types";
import { TaskHubView } from "./views/TaskHubView";
import { createTaskHubNoteComposer, type TaskHubNoteComposer } from "./views/noteComposer";
import { populateRecurrenceSelect } from "./views/recurrenceControls";

export type CreateTaskOptions = {
  onTaskCreated?: (task: TaskItem) => void;
  onDatedNoteCreated?: (note: DatedNote) => void;
  allowDatedNote?: boolean;
  initialKind?: CalendarCreationKind | "note";
};

type CreateItemKind = CalendarCreationKind | "note";

function validCalendarEventDuration(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return 60;
  return Math.max(1, Math.min(365 * 24 * 60, Math.round(value)));
}

function timeInputValue(startMinutes: number | undefined): string {
  if (startMinutes === undefined) return "";
  const safeMinutes = snapDayStartMinutes(startMinutes);
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
}

function parseTimeInputValue(value: string): number | undefined {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return snapDayStartMinutes(hours * 60 + minutes);
}

function startMinutesFromTask(task: TaskItem): number | undefined {
  const time = task.scheduledDate?.match(/T(\d{2}):(\d{2})/);
  return time ? parseTimeInputValue(`${time[1]}:${time[2]}`) : undefined;
}

function vaultTaskWithDescendants(allTasks: TaskItem[], rootTask: TaskItem): TaskItem[] {
  const childrenByParentId = new Map<string, TaskItem[]>();
  for (const task of allTasks) {
    if (task.source !== "vault" || task.filePath !== rootTask.filePath || !task.parentId) continue;
    const children = childrenByParentId.get(task.parentId) ?? [];
    children.push(task);
    childrenByParentId.set(task.parentId, children);
  }

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.line - right.line);
  }

  const result: TaskItem[] = [];
  const visitedTaskIds = new Set<string>();
  const visit = (task: TaskItem) => {
    if (visitedTaskIds.has(task.id)) return;
    visitedTaskIds.add(task.id);
    result.push(task);
    for (const child of childrenByParentId.get(task.id) ?? []) {
      visit(child);
    }
  };
  visit(rootTask);
  return result;
}

function rescheduleVaultTaskTreeInContent(
  content: string,
  tasks: TaskItem[],
  targetDate: string,
  messages: RescheduleMessages,
  rootStartMinutes?: number
): { result: CompletionResult; updatedTasks: Array<{ task: TaskItem; result: CompletionResult }> } {
  let nextContent = content;
  const updatedTasks: Array<{ task: TaskItem; result: CompletionResult }> = [];

  for (const [index, task] of tasks.entries()) {
    const startMinutes = index === 0 ? rootStartMinutes : startMinutesFromTask(task);
    const result = rescheduleTaskInContent(nextContent, task, targetDate, messages, startMinutes);
    if (result.status === "conflict") {
      return { result, updatedTasks: [] };
    }
    if (result.status === "updated") {
      nextContent = result.content;
      updatedTasks.push({ task, result });
    }
  }

  if (updatedTasks.length === 0) {
    return { result: { status: "already_in_state" }, updatedTasks };
  }

  const firstUpdate = updatedTasks[0].result;
  return {
    result: firstUpdate.status === "updated" ? { ...firstUpdate, content: nextContent } : firstUpdate,
    updatedTasks
  };
}

function eventDurationFromDraft(draft: Extract<CalendarItemEditDraft, { kind: "event" }>): number | undefined {
  if (draft.allDay) return undefined;
  const start = draft.startTime ? parseTimeInputValue(draft.startTime) : undefined;
  const end = draft.endTime ? parseTimeInputValue(draft.endTime) : undefined;
  if (start === undefined || end === undefined) return undefined;
  return Math.max(1, end - start);
}

function durationInputParts(durationMinutes: number | undefined): { days: string; hours: string; minutes: string } {
  const safeDuration = validCalendarEventDuration(durationMinutes);
  const days = Math.floor(safeDuration / (24 * 60));
  const remainder = safeDuration - days * 24 * 60;
  const hours = Math.floor(remainder / 60);
  const minutes = remainder % 60;
  return {
    days: String(days),
    hours: String(hours),
    minutes: String(minutes)
  };
}

function durationFromInputParts(days: string, hours: string, minutes: string): number {
  const parsedDays = Math.max(0, Math.min(365, Math.floor(Number(days) || 0)));
  const parsedHours = Math.max(0, Math.min(23, Math.floor(Number(hours) || 0)));
  const parsedMinutes = Math.max(0, Math.min(59, Math.floor(Number(minutes) || 0)));
  return validCalendarEventDuration(parsedDays * 24 * 60 + parsedHours * 60 + parsedMinutes);
}

function noteBodyFromContent(content: string): string {
  if (!content.startsWith("---")) return content.replace(/\s+$/u, "");
  return (content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/u)?.[1] ?? "").replace(/\s+$/u, "");
}

export default class TaskHubPlugin extends Plugin {
  settings: TaskHubSettings = DEFAULT_SETTINGS;
  taskIndex: TaskIndex = this.createTaskIndex();
  taskNoteIndex: TaskNoteIndex = this.createTaskNoteIndex();
  datedNoteIndex: DatedNoteIndex = this.createDatedNoteIndex();
  hubNoteIndex: HubNoteIndex = this.createHubNoteIndex();
  localAppleTasks: TaskItem[] = [];
  localAppleEvents: CalendarEvent[] = [];
  localAppleStatus: LocalAppleSyncStatus = { state: "never" };
  didaTasks: TaskItem[] = [];
  private appleReminderWriteQueue: Promise<unknown> = Promise.resolve();
  private lastTaskUndoAction: { undo: () => Promise<boolean> } | undefined;
  private isUndoingTaskChange = false;

  isLocalAppleSupported(): boolean {
    return Platform.isDesktopApp && process.platform === "darwin";
  }

  notifyLocalAppleUnsupported(): void {
    new Notice(createTranslator(this.settings.language)("localAppleUnsupportedPlatform"));
  }

  private isLocalAppleErrorCode(error: unknown, code: AppleHelperErrorCode): boolean {
    return typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
  }

  private localAppleErrorMessage(error: unknown, service: "calendar" | "reminders"): string {
    const t = createTranslator(this.settings.language);
    if (this.isLocalAppleErrorCode(error, "not_determined")) {
      return service === "reminders" ? t("localAppleRemindersPermissionPending") : t("localAppleCalendarPermissionBlocked");
    }
    if (this.isLocalAppleErrorCode(error, "permission_denied") || this.isLocalAppleErrorCode(error, "restricted")) {
      return service === "reminders" ? t("localAppleRemindersPermissionBlocked") : t("localAppleCalendarPermissionBlocked");
    }
    return error instanceof Error ? error.message : String(error);
  }

  private async requestRemindersAccessAfterNotDetermined(error: unknown): Promise<boolean> {
    if (!this.isLocalAppleErrorCode(error, "not_determined")) return false;

    const t = createTranslator(this.settings.language);
    const attemptedAt = new Date().toISOString();
    const status = await requestLocalAppleAccess({ reminders: true, calendar: false });
    const nextStatus = localAppleStatusFromHelper(status, attemptedAt);
    const granted = status.remindersStatus?.authorization === "fullAccess" || status.remindersStatus?.authorization === "authorized";
    if (nextStatus.reminders?.state === "ok") {
      this.localAppleStatus = {
        state: "ok",
        lastSyncedAt: attemptedAt,
        itemCount: this.localAppleTasks.length + this.localAppleEvents.length,
        reminders: nextStatus.reminders,
        calendar: this.localAppleStatus.calendar ?? { state: "never" }
      };
    } else {
      this.localAppleStatus = {
        state: "error",
        lastAttemptAt: attemptedAt,
        message: nextStatus.reminders?.state === "error" ? nextStatus.reminders.message : t("localAppleRemindersPermissionPending"),
        reminders: nextStatus.reminders ?? { state: "never" },
        calendar: this.localAppleStatus.calendar ?? { state: "never" }
      };
    }
    this.refreshOpenViews();
    if (!granted) {
      throw new Error(t("localAppleRemindersPermissionPending"));
    }
    return true;
  }

  private async writeAppleReminderWithAccessRetry<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!(await this.requestRemindersAccessAfterNotDetermined(error))) {
        throw new Error(this.localAppleErrorMessage(error, "reminders"));
      }
      return write();
    }
  }

  private runAppleReminderWrite<T>(write: () => Promise<T>): Promise<T> {
    const run = this.appleReminderWriteQueue.then(() => this.writeAppleReminderWithAccessRetry(write));
    this.appleReminderWriteQueue = run.catch(() => undefined);
    return run;
  }

  canCreateAppleReminders(): boolean {
    return canCreateAppleRemindersCapability(this.settings.localApple, this.isLocalAppleSupported());
  }

  canSendTasksToAppleCalendar(): boolean {
    return (
      this.isLocalAppleSupported() &&
      this.settings.localApple.enabled &&
      this.settings.localApple.calendarEnabled &&
      this.settings.localApple.calendarTaskSendEnabled
    );
  }

  canConvertAppleCalendarAndReminders(): boolean {
    return (
      this.isLocalAppleSupported() &&
      this.settings.localApple.enabled &&
      this.settings.localApple.calendarEnabled &&
      this.settings.localApple.remindersEnabled &&
      this.settings.localApple.calendarWritebackEnabled &&
      this.settings.localApple.remindersWritebackEnabled &&
      this.settings.localApple.remindersCreateEnabled
    );
  }

  notifyLocalAppleConversionDisabled(): void {
    new Notice(createTranslator(this.settings.language)("appleCalendarReminderConversionDisabled"));
  }

  getAppleReminderLists() {
    return this.settings.localApple.remindersLists;
  }

  private isAppleReminderSourceMoveError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("com.apple.reminderkit error -3002") || message.includes("Moving between lists is unsupported in this account");
  }

  getAppleReminderListColors(): Record<string, string> {
    return Object.fromEntries(
      this.settings.localApple.remindersLists.map((list) => [
        list.id,
        this.settings.localApple.reminderColorOverrides[list.id] ?? this.settings.localApple.remindersColor
      ])
    );
  }

  getAppleCalendars() {
    return this.settings.localApple.calendars;
  }

  canCreateDidaTasks(): boolean {
    return canCreateDidaTasksCapability(this.settings.dida);
  }

  getDidaProjects() {
    return this.settings.dida.projects;
  }

  getDidaProjectColors(): Record<string, string> {
    return Object.fromEntries(
      this.settings.dida.projects.map((project) => [
        project.id,
        this.settings.dida.taskColorOverrides[project.id] ?? this.settings.dida.tasksColor
      ])
    );
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.configureLocalAppleHelper();
    this.taskIndex = this.createTaskIndex();
    this.taskNoteIndex = this.createTaskNoteIndex();
    this.datedNoteIndex = this.createDatedNoteIndex();
    this.hubNoteIndex = this.createHubNoteIndex();
    registerTaskHubIcon();

    this.registerView(TASK_HUB_VIEW_TYPE, (leaf: WorkspaceLeaf) => new TaskHubView(leaf, this));
    this.addSettingTab(new TaskHubSettingTab(this.app, this));

    this.addRibbonIcon(TASK_HUB_ICON_ID, PLUGIN_DISPLAY_NAME, () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open",
      name: createTranslator(this.settings.language)("openTaskHub"),
      callback: () => void this.activateView()
    });

    this.addCommand({
      id: "rescan",
      name: createTranslator(this.settings.language)("rescanTaskHub"),
      callback: () => void this.scanVault()
    });

    this.addCommand({
      id: "undo-last-task-change",
      name: createTranslator(this.settings.language)("undoLastTaskChange"),
      callback: () => void this.undoLastTaskChange()
    });

    this.addCommand({
      id: "send-current-task-to-apple-reminders",
      name: createTranslator(this.settings.language)("sendCurrentTaskToAppleReminders"),
      editorCallback: (editor: Editor, view: MarkdownView) => {
        void this.sendEditorTaskToAppleReminders(editor, view);
      }
    });

    this.registerVaultEvents();
    this.registerEditorMenu();

    if (this.settings.indexOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        void this.scanVault();
        void this.syncExternalTasks();
      });
    } else {
      this.app.workspace.onLayoutReady(() => {
        void this.syncExternalTasks();
      });
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<TaskHubSettings> | null;
    this.settings = normalizeTaskHubSettings(loaded);
  }

  async saveSettings(): Promise<void> {
    this.cleanupTaskListManualOrderState();
    this.cleanupTaskNoteManualOrderState();
    this.cleanupTaskNotePinnedState();
    this.cleanupExternalTaskMetadataState();
    await this.saveData(this.settings);
    this.refreshOpenViews();
  }

  private cleanupTaskListManualOrderState(): boolean {
    if (!this.taskIndex || typeof this.taskIndex.getTasks !== "function") return false;
    const cleaned = cleanupTaskListManualOrder(this.settings.taskListManualOrder, this.getTasks());
    if (JSON.stringify(cleaned) === JSON.stringify(this.settings.taskListManualOrder)) return false;
    this.settings.taskListManualOrder = cleaned;
    return true;
  }

  private cleanupTaskNoteManualOrderState(): boolean {
    if (!this.taskIndex || typeof this.taskIndex.getTasks !== "function") return false;
    if (!this.taskNoteIndex || typeof this.taskNoteIndex.getNotesForKey !== "function") return false;
    const nextManualOrder: TaskHubSettings["taskNoteManualOrder"] = {};
    for (const task of this.getTasks()) {
      const notes = this.getTaskNotes(task);
      if (notes.length === 0) continue;
      const scopeKey = taskNoteOrderScopeKey(task);
      const cleaned = cleanupTaskNoteManualOrderEntry(notes, this.settings.taskNoteManualOrder[scopeKey] ?? []);
      if (cleaned.length > 0) nextManualOrder[scopeKey] = cleaned;
    }
    if (JSON.stringify(nextManualOrder) === JSON.stringify(this.settings.taskNoteManualOrder)) return false;
    this.settings.taskNoteManualOrder = nextManualOrder;
    return true;
  }

  private cleanupTaskNotePinnedState(): boolean {
    if (!this.taskIndex || typeof this.taskIndex.getTasks !== "function") return false;
    if (!this.taskNoteIndex || typeof this.taskNoteIndex.getNotesForKey !== "function") return false;
    const nextPinned: TaskHubSettings["taskNotePinned"] = {};
    for (const task of this.getTasks()) {
      const notes = this.getTaskNotes(task);
      if (notes.length === 0) continue;
      const scopeKey = taskNoteOrderScopeKey(task);
      const cleaned = cleanupTaskNotePinnedEntry(notes, this.settings.taskNotePinned[scopeKey] ?? []);
      if (cleaned.length > 0) nextPinned[scopeKey] = cleaned;
    }
    if (JSON.stringify(nextPinned) === JSON.stringify(this.settings.taskNotePinned)) return false;
    this.settings.taskNotePinned = nextPinned;
    return true;
  }

  private cleanupExternalTaskMetadataState(liveStableIds?: Set<string>): boolean {
    const nextMetadata: TaskHubSettings["externalTaskMetadata"] = {};
    for (const [stableId, metadata] of Object.entries(this.settings.externalTaskMetadata)) {
      if (!metadata || (liveStableIds && !liveStableIds.has(stableId))) continue;
      const nextRecord: TaskHubSettings["externalTaskMetadata"][string] = {};
      if (metadata.startDate) nextRecord.startDate = metadata.startDate;
      if (metadata.lastSeenAt) nextRecord.lastSeenAt = metadata.lastSeenAt;
      if (nextRecord.startDate || nextRecord.lastSeenAt) {
        nextMetadata[stableId] = nextRecord;
      }
    }
    if (JSON.stringify(nextMetadata) === JSON.stringify(this.settings.externalTaskMetadata)) return false;
    this.settings.externalTaskMetadata = nextMetadata;
    return true;
  }

  private async persistTaskIndexStateIfNeeded(): Promise<void> {
    if (!this.taskIndex || typeof this.taskIndex.consumePersistenceDirty !== "function") return;
    if (!this.taskIndex.consumePersistenceDirty()) return;
    await this.saveData(this.settings);
  }

  private configureLocalAppleHelper(): void {
    const adapter = this.app.vault.adapter as typeof this.app.vault.adapter & { getFullPath?: (path: string) => string };
    const pluginDir = this.manifest.dir;
    if (!pluginDir || typeof adapter.getFullPath !== "function") return;
    const helperPath = adapter.getFullPath(`${pluginDir}/taskhub-apple-helper`);
    installBundledAppleHelper(helperPath);
    configureLocalAppleHelperPath(helperPath);
  }

  async scanVault(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles().map((file) => this.toIndexableFile(file));
    await this.taskIndex.scanFiles(files);
    await this.taskNoteIndex.scanFiles(files);
    await this.datedNoteIndex.scanFiles(files);
    await this.hubNoteIndex.scanFiles(files);
    await this.syncExternalTasks({ silent: true });
    this.cleanupTaskListManualOrderState();
    await this.persistTaskIndexStateIfNeeded();
    this.refreshOpenViews();
  }

  async completeTask(task: TaskItem): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);

    if (task.source === "dida") {
      if (!this.settings.dida.tasksWritebackEnabled || !task.externalId || !task.externalListId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      try {
        const client = this.createDidaClient();
        if (task.completed) {
          await client.reopenTask(task.externalListId, task.externalId, task.text);
        } else {
          await client.completeTask(task.externalListId, task.externalId);
        }
        await this.syncDida({ silent: true });
        this.rememberTaskCompletionUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(task.completed ? t("taskReopened") : t("taskCompleted"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source === "apple-reminders") {
      if (!this.isLocalAppleSupported()) {
        const result: CompletionResult = { status: "conflict", message: t("localAppleUnsupportedPlatform") };
        new Notice(result.message);
        return result;
      }

      if (!this.settings.localApple.remindersWritebackEnabled || !task.externalId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }

      try {
        const reminderId = task.externalId;
        await this.writeAppleReminderWithAccessRetry(() => setAppleReminderCompleted(reminderId, !task.completed));
        await this.syncLocalApple({ silent: true });
        this.rememberTaskCompletionUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(task.completed ? t("taskReopened") : t("taskCompleted"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = {
          status: "conflict",
          message: error instanceof Error ? error.message : String(error)
        };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const completion = {
      result: {
        status: "conflict",
        message: t("taskUpdateFailed")
      } as CompletionResult
    };

    await this.app.vault.process(file, (content) => {
      completion.result = completeTaskInContent(content, task, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile")
      }, task.completed ? "reopen" : "complete");
      return completion.result.status === "updated" ? completion.result.content : content;
    });

    const completionResult = completion.result;
    if (completionResult.status === "updated") {
      this.rememberReindexedVaultTaskStableId(task, completionResult);
      await this.reindexVaultFile(file);
      const updatedTask = this.resolveUndoTask(task, completionResult);
      const noteMigration = updatedTask ? await this.transferTaskNotesToUpdatedTask(task, updatedTask) : { ok: true as const };
      if (!noteMigration.ok) new Notice(noteMigration.message);
      this.rememberTaskCompletionUndo(task, this.resolveUndoTask(task, completionResult));
      new Notice(task.completed ? t("taskReopened") : t("taskCompleted"));
    } else if (completionResult.status === "already_in_state") {
      new Notice(task.completed ? t("taskReopened") : t("taskAlreadyCompleted"));
    } else {
      new Notice(completionResult.message);
    }

    this.refreshOpenViews();
    return completionResult;
  }

  async rescheduleTask(task: TaskItem, target: CalendarDropTarget): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    if (isUnscheduledCalendarDropTarget(target)) {
      return this.unscheduleTask(task);
    }
    const timedTarget = calendarDropTargetParts(target);

    if (task.source === "dida") {
      if (
        !this.settings.dida.tasksWritebackEnabled ||
        !this.settings.dida.tasksDragRescheduleEnabled ||
        !task.externalId ||
        !task.externalListId
      ) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      if (timedTarget.startMinutes === undefined && taskPlannedDateKey(task) === timedTarget.dateKey && startMinutesFromTask(task) === undefined) {
        new Notice(t("taskDateAlreadySet"));
        return { status: "already_in_state" };
      }
      try {
        await this.createDidaClient().updateTask(
          task.externalListId,
          task.externalId,
          taskItemToDidaPayload({
            title: task.text,
            projectId: task.externalListId,
            notes: task.contextPreview,
            date: timedTarget.dateKey,
            startDate: taskStartDateForRepair(task, timedTarget.dateKey),
            startMinutes: timedTarget.startMinutes,
            tags: this.settings.dida.tasksCreateTagsEnabled ? task.tags : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: task.recurrence
          })
        );
        await this.syncDida({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskDateUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source === "apple-reminders") {
      if (!this.isLocalAppleSupported()) {
        const result: CompletionResult = { status: "conflict", message: t("localAppleUnsupportedPlatform") };
        new Notice(result.message);
        return result;
      }

      if (!this.settings.localApple.remindersWritebackEnabled || !task.externalId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }

      if (timedTarget.startMinutes === undefined && taskPlannedDateKey(task) === timedTarget.dateKey && startMinutesFromTask(task) === undefined) {
        new Notice(t("taskDateAlreadySet"));
        return { status: "already_in_state" };
      }

      try {
        const reminderId = task.externalId;
        this.rememberAppleReminderStartDate(reminderId, task, timedTarget.dateKey);
        await this.runAppleReminderWrite(() =>
          setAppleReminderDueDate(reminderId, timedTarget.dateKey, timedTarget.startMinutes)
        );
        await this.syncLocalApple({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskDateUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = {
          status: "conflict",
          message: error instanceof Error ? error.message : String(error)
        };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const update = {
      result: {
        status: "conflict",
        message: t("taskUpdateFailed")
      } as CompletionResult
    };

    const indexedTasks =
      this.taskIndex && typeof (this.taskIndex as unknown as { getTasks?: () => TaskItem[] }).getTasks === "function"
        ? this.getTasks()
        : [task];
    const tasksToReschedule = vaultTaskWithDescendants(indexedTasks, task);
    const rescheduledVaultTasks: Array<{ task: TaskItem; result: CompletionResult }> = [];

    await this.app.vault.process(file, (content) => {
      const reschedule = rescheduleVaultTaskTreeInContent(content, tasksToReschedule, timedTarget.dateKey, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile"),
        dateTokenMissing: t("taskDateTokenMissing")
      }, timedTarget.startMinutes);
      update.result = reschedule.result;
      rescheduledVaultTasks.splice(0, rescheduledVaultTasks.length, ...reschedule.updatedTasks);
      return update.result.status === "updated" ? update.result.content : content;
    });

    const updateResult = update.result;
    if (updateResult.status === "updated") {
      for (const item of rescheduledVaultTasks) {
        this.rememberReindexedVaultTaskStableId(item.task, item.result);
      }
      await this.reindexVaultFile(file);
      for (const item of rescheduledVaultTasks) {
        const updatedTask = this.resolveUndoTask(item.task, item.result);
        const noteMigration = updatedTask ? await this.transferTaskNotesToUpdatedTask(item.task, updatedTask) : { ok: true as const };
        if (!noteMigration.ok) new Notice(noteMigration.message);
      }
      this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, updateResult));
      new Notice(t("taskDateUpdated"));
    } else if (updateResult.status === "already_in_state") {
      new Notice(t("taskDateAlreadySet"));
    } else {
      new Notice(updateResult.message);
    }

    this.refreshOpenViews();
    return updateResult;
  }

  private async unscheduleTask(task: TaskItem): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);

    if (!taskPlannedDateKey(task) && startMinutesFromTask(task) === undefined) {
      new Notice(t("taskDateAlreadySet"));
      return { status: "already_in_state" };
    }

    if (task.source === "dida") {
      if (
        !this.settings.dida.tasksWritebackEnabled ||
        !this.settings.dida.tasksDragRescheduleEnabled ||
        !task.externalId ||
        !task.externalListId
      ) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      try {
        await this.createDidaClient().updateTask(
          task.externalListId,
          task.externalId,
          taskItemToDidaPayload({
            title: task.text,
            projectId: task.externalListId,
            notes: task.contextPreview,
            date: null,
            startDate: null,
            tags: this.settings.dida.tasksCreateTagsEnabled ? task.tags : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: task.recurrence
          })
        );
        await this.syncDida({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskDateUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source === "apple-reminders") {
      if (!this.isLocalAppleSupported()) {
        const result: CompletionResult = { status: "conflict", message: t("localAppleUnsupportedPlatform") };
        new Notice(result.message);
        return result;
      }

      if (!this.settings.localApple.remindersWritebackEnabled || !task.externalId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }

      try {
        await this.runAppleReminderWrite(() =>
          setAppleReminderDetails({
            id: task.externalId as string,
            title: task.text,
            dueDate: null,
            alertMinutesBefore: null,
            notes: task.contextPreview,
            tags: task.tags,
            recurrence: task.recurrence
          })
        );
        this.clearAppleReminderStartDate(task.externalId);
        await this.syncLocalApple({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskDateUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = {
          status: "conflict",
          message: error instanceof Error ? error.message : String(error)
        };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const update = {
      result: {
        status: "conflict",
        message: t("taskUpdateFailed")
      } as CompletionResult
    };

    await this.app.vault.process(file, (content) => {
      update.result = unscheduleTaskInContent(content, task, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile")
      });
      return update.result.status === "updated" ? update.result.content : content;
    });

    const updateResult = update.result;
    if (updateResult.status === "updated") {
      this.rememberReindexedVaultTaskStableId(task, updateResult);
      await this.reindexVaultFile(file);
      const updatedTask = this.resolveUndoTask(task, updateResult);
      const noteMigration = updatedTask ? await this.transferTaskNotesToUpdatedTask(task, updatedTask) : { ok: true as const };
      if (!noteMigration.ok) new Notice(noteMigration.message);
      this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, updateResult));
      new Notice(t("taskDateUpdated"));
    } else if (updateResult.status === "already_in_state") {
      new Notice(t("taskDateAlreadySet"));
    } else {
      new Notice(updateResult.message);
    }

    this.refreshOpenViews();
    return updateResult;
  }

  async reorderTaskListDate(task: TaskItem, anchorTask: TaskItem, position: TaskListDropPosition): Promise<void> {
    const dateKey = taskListDateKey(task);
    if (!dateKey || dateKey !== taskListDateKey(anchorTask)) return;

    const tasksOnDate = sortTasksForTaskList(this.getTasks()).filter((candidate) => taskListDateKey(candidate) === dateKey);
    if (tasksOnDate.length <= 1) return;

    const nextOrder = reorderTaskListDate(tasksOnDate, this.settings.taskListManualOrder, task, anchorTask, position);
    const nextManualOrder = cleanupTaskListManualOrder(
      {
        ...this.settings.taskListManualOrder,
        [dateKey]: nextOrder
      },
      this.getTasks()
    );
    if (JSON.stringify(nextManualOrder) === JSON.stringify(this.settings.taskListManualOrder)) return;
    this.settings.taskListManualOrder = nextManualOrder;
    await this.saveSettings();
  }

  async deleteCalendarTask(task: TaskItem): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    if (task.source === "dida") {
      if (!this.settings.dida.tasksDeleteEnabled || !task.externalId || !task.externalListId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      try {
        await this.createDidaClient().deleteTask(task.externalListId, task.externalId);
        await this.syncDida({ silent: true });
        this.clearLastTaskUndoAction();
        new Notice(t("calendarItemDeleted"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source === "apple-reminders") {
      if (!canDeleteAppleReminderCapability(this.settings.localApple, this.isLocalAppleSupported(), task.externalId)) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      try {
        const reminderId = task.externalId as string;
        await this.runAppleReminderWrite(() => deleteAppleReminder(reminderId));
        await this.syncLocalApple({ silent: true });
        this.clearLastTaskUndoAction();
        new Notice(t("calendarItemDeleted"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const deletion = { result: { status: "conflict", message: t("taskUpdateFailed") } as CompletionResult };
    await this.app.vault.process(file, (content) => {
      deletion.result = deleteTaskInContent(content, task, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile")
      });
      return deletion.result.status === "updated" ? deletion.result.content : content;
    });
    if (deletion.result.status === "updated") {
      await this.reindexVaultFile(file);
      this.clearLastTaskUndoAction();
      new Notice(t("calendarItemDeleted"));
    } else if (deletion.result.status === "conflict") {
      new Notice(deletion.result.message);
    }
    this.refreshOpenViews();
    return deletion.result;
  }

  async deleteCalendarEvent(event: CalendarEvent): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    if (
      event.sourceId !== "apple-calendar" ||
      !canDeleteAppleCalendarEventCapability(
        this.settings.localApple,
        this.isLocalAppleSupported(),
        this.isWritableAppleCalendarEvent(event),
        event.id
      )
    ) {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }
    try {
      await deleteAppleCalendarEvent(event.id);
      await this.syncLocalApple({ silent: true });
      new Notice(t("calendarItemDeleted"));
      this.refreshOpenViews();
      return { status: "updated", content: "", line: 0 };
    } catch (error) {
      const result: CompletionResult = { status: "conflict", message: this.localAppleErrorMessage(error, "calendar") };
      new Notice(result.message);
      return result;
    }
  }

  async rescheduleCalendarEvent(event: CalendarEvent, target: CalendarDropTarget): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    const timedTarget = calendarDropTargetParts(target);

    if (
      event.sourceId !== "apple-calendar" ||
      !this.isLocalAppleSupported() ||
      !this.settings.localApple.enabled ||
      !this.settings.localApple.calendarEnabled ||
      !this.settings.localApple.calendarWritebackEnabled ||
      !this.isWritableAppleCalendarEvent(event)
    ) {
      const result: CompletionResult = {
        status: "conflict",
        message: !this.isLocalAppleSupported() ? t("localAppleUnsupportedPlatform") : t("externalTaskReadOnly")
      };
      new Notice(result.message);
      return result;
    }

    if (event.start.slice(0, 10) === timedTarget.dateKey && timedTarget.startMinutes === undefined) {
      new Notice(t("taskDateAlreadySet"));
      return { status: "already_in_state" };
    }

    try {
      await setAppleCalendarEventDate({
        id: event.id,
        targetDate: timedTarget.dateKey,
        startMinutes: timedTarget.startMinutes,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        durationMinutes: timedTarget.durationMinutes
      });
      await this.syncLocalApple({ silent: true });
      new Notice(t("taskDateUpdated"));
      this.refreshOpenViews();
      return { status: "updated", content: "", line: 0 };
    } catch (error) {
      const result: CompletionResult = {
        status: "conflict",
        message: this.localAppleErrorMessage(error, "calendar")
      };
      new Notice(result.message);
      return result;
    }
  }

  async updateCalendarTask(task: TaskItem, draft: Extract<CalendarItemEditDraft, { kind: "task" }>): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    const title = draft.title.replace(/\s+/g, " ").trim();
    if (!title) {
      const result: CompletionResult = { status: "conflict", message: t("taskUpdateFailed") };
      new Notice(result.message);
      return result;
    }

    if (task.source === "dida") {
      if (!this.settings.dida.tasksWritebackEnabled || !task.externalId || !task.externalListId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      const projectId = draft.reminderListId || task.externalListId;
      const recurrence = draft.recurrence === undefined ? task.recurrence : draft.recurrence;
      try {
        await this.createDidaClient().updateTask(
          task.externalListId,
          task.externalId,
          taskItemToDidaPayload({
            title,
            projectId,
            notes: draft.notes,
            date: draft.date || null,
            startDate: taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? draft.date ?? undefined,
            startMinutes: draft.startTime ? parseTimeInputValue(draft.startTime) : undefined,
            tags: this.settings.dida.tasksCreateTagsEnabled ? (draft.tags ?? task.tags) : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: recurrence === null ? "" : recurrence
          })
        );
        await this.syncDida({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        const result: CompletionResult = { status: "conflict", message: error instanceof Error ? error.message : String(error) };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source === "apple-reminders") {
      if (!this.isLocalAppleSupported()) {
        const result: CompletionResult = { status: "conflict", message: t("localAppleUnsupportedPlatform") };
        new Notice(result.message);
        return result;
      }
      if (!this.settings.localApple.remindersWritebackEnabled || !task.externalId) {
        const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
        new Notice(result.message);
        return result;
      }
      const reminderTags = draft.tags ?? task.tags;
      const recurrence = draft.recurrence === undefined ? task.recurrence : draft.recurrence;
      const input = {
        id: task.externalId,
        title,
        dueDate: draft.date || null,
        startMinutes: draft.startTime ? parseTimeInputValue(draft.startTime) : undefined,
        alertMinutesBefore: draft.startTime ? draft.alertMinutesBefore ?? null : null,
        listId: draft.reminderListId || undefined,
        notes: draft.notes,
        tags: reminderTags,
        ...(draft.recurrence !== undefined || task.recurrence ? { recurrence } : {})
      };
      try {
        this.rememberAppleReminderStartDate(task.externalId, task, draft.date || taskPlannedDateKey(task));
        await this.runAppleReminderWrite(() => setAppleReminderDetails(input));
        await this.syncLocalApple({ silent: true });
        this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
        new Notice(t("taskUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
        if (
          draft.reminderListId &&
          draft.reminderListId !== task.externalListId &&
          this.canCreateAppleReminders() &&
          this.isAppleReminderSourceMoveError(error)
        ) {
          try {
            const replacementReminderId = await this.runAppleReminderWrite(() =>
              this.recreateAppleReminderFromDraft(task, draft, title, reminderTags, recurrence)
            );
            this.rememberAppleReminderListMoveUndo(task, replacementReminderId, task.externalListId);
            this.migrateExternalTaskMetadata(
              this.externalTaskMetadataKey("apple-reminders", task.externalId),
              this.externalTaskMetadataKey("apple-reminders", replacementReminderId)
            );
            await this.syncLocalApple({ silent: true });
            this.updateAppleReminderLinks(task.externalId, replacementReminderId);
            const noteTransfer = await this.transferTaskNotesToAppleReminder(task, replacementReminderId);
            if (!noteTransfer.ok) new Notice(noteTransfer.message);
            this.refreshOpenViews();
            new Notice(t("taskUpdated"));
            return { status: "updated", content: "", line: 0 };
          } catch (fallbackError) {
            const result: CompletionResult = {
              status: "conflict",
              message: this.localAppleErrorMessage(fallbackError, "reminders")
            };
            new Notice(result.message);
            return result;
          }
        }
        const result: CompletionResult = { status: "conflict", message: this.localAppleErrorMessage(error, "reminders") };
        new Notice(result.message);
        return result;
      }
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("externalTaskReadOnly") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const update = { result: { status: "conflict", message: t("taskUpdateFailed") } as CompletionResult };
    const recurrence = draft.recurrence === undefined ? task.recurrence : draft.recurrence;
    await this.app.vault.process(file, (content) => {
      update.result = updateTaskLineInContent(content, task, {
        title,
        date: draft.date,
        startTime: draft.startTime,
        tags: draft.tags ?? [],
        recurrence
      }, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile")
      });
      return update.result.status === "updated" ? update.result.content : content;
    });
    if (update.result.status === "updated") {
      this.rememberReindexedVaultTaskStableId(task, update.result);
      await this.reindexVaultFile(file);
      const updatedTask = this.resolveUndoTask(task, update.result);
      const noteMigration = updatedTask ? await this.transferTaskNotesToUpdatedTask(task, updatedTask) : { ok: true as const };
      if (!noteMigration.ok) new Notice(noteMigration.message);
      this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, update.result));
      new Notice(t("taskUpdated"));
    } else if (update.result.status === "conflict") {
      new Notice(update.result.message);
    }
    this.refreshOpenViews();
    return update.result;
  }

  async updateCalendarEvent(event: CalendarEvent, draft: Extract<CalendarItemEditDraft, { kind: "event" }>): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    const title = draft.title.replace(/\s+/g, " ").trim();
    if (
      !title ||
      event.sourceId !== "apple-calendar" ||
      !this.isLocalAppleSupported() ||
      !this.settings.localApple.enabled ||
      !this.settings.localApple.calendarEnabled ||
      !this.settings.localApple.calendarWritebackEnabled ||
      !this.isWritableAppleCalendarEvent(event)
    ) {
      const result: CompletionResult = {
        status: "conflict",
        message: !this.isLocalAppleSupported() ? t("localAppleUnsupportedPlatform") : t("externalTaskReadOnly")
      };
      new Notice(result.message);
      return result;
    }

    try {
      await setAppleCalendarEventDetails({
        id: event.id,
        title,
        targetDate: draft.date,
        startMinutes: draft.allDay || !draft.startTime ? undefined : parseTimeInputValue(draft.startTime),
        durationMinutes: eventDurationFromDraft(draft),
        start: event.start,
        end: event.end,
        allDay: draft.allDay,
        calendarId: draft.calendarId || undefined,
        notes: draft.notes,
        location: draft.location,
        ...(draft.recurrence !== undefined || event.recurrence
          ? {
              recurrence: draft.recurrence === undefined ? event.recurrence : draft.recurrence,
              recurrenceScope: draft.recurrenceScope ?? "this"
            }
          : {})
      });
      await this.syncLocalApple({ silent: true });
      new Notice(t("eventUpdated"));
      this.refreshOpenViews();
      return { status: "updated", content: "", line: 0 };
    } catch (error) {
      const result: CompletionResult = { status: "conflict", message: this.localAppleErrorMessage(error, "calendar") };
      new Notice(result.message);
      return result;
    }
  }

  defaultTaskSendTarget(): TaskSendTarget | undefined {
    return preferredTaskSendTarget(
      taskSendTargetOptions({
        allowAppleReminderCreate: this.canCreateAppleReminders(),
        allowDidaCreate: this.canCreateDidaTasks(),
        appleReminderLists: this.getAppleReminderLists(),
        didaProjects: this.getDidaProjects()
      }, {
        appleReminders: "Apple Reminders",
        appleRemindersInbox: "Inbox",
        dida: "Dida",
        didaInbox: "Inbox"
      }),
      this.settings.taskSendDefaultTarget
    )?.target;
  }

  async sendTaskToTarget(task: TaskItem, target: TaskSendTarget | undefined = this.defaultTaskSendTarget()): Promise<void> {
    if (!target) {
      new Notice(createTranslator(this.settings.language)("sendToNoTargets"));
      return;
    }
    if (target.type === "dida") {
      await this.sendTaskToDida(task, target);
      return;
    }
    await this.sendTaskToAppleReminders(task, target);
  }

  async sendTaskToAppleReminders(task: TaskItem, target: Extract<TaskSendTarget, { type: "apple-reminders" }> = { type: "apple-reminders" }): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (!this.canCreateAppleReminders()) {
      new Notice(t("appleReminderCreateDisabled"));
      return;
    }

    if (task.source !== "vault") {
      new Notice(t("appleReminderCreateVaultOnly"));
      return;
    }

    const existingId = this.settings.appleReminderLinks[task.id];
    if (existingId) {
      new Notice(`${t("appleReminderAlreadySent")}: ${existingId}`);
      return;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${task.filePath}`);
      return;
    }

    const content = await this.app.vault.read(file);
    const currentTask = parseTaskAtLine({ filePath: task.filePath, content, line: task.line });
    if (!currentTask || currentTask.rawLine !== task.rawLine) {
      new Notice(t("lineChangedConflict"));
      return;
    }

    try {
      const input = {
        title: currentTask.text,
        notes: this.appleReminderNotes(currentTask),
        dueDate: taskPlannedDateKey(currentTask),
        startMinutes: startMinutesFromTask(currentTask),
        listId: target.listId ?? this.settings.localApple.remindersDefaultListId,
        tags: this.settings.localApple.remindersCreateTagsEnabled ? normalizeAppleReminderTags(currentTask.tags) : [],
        ...(currentTask.recurrence ? { recurrence: currentTask.recurrence } : {})
      };
      const reminderId = await this.writeAppleReminderWithAccessRetry(() => createAppleReminder(input));
      this.rememberAppleReminderStartDate(reminderId, currentTask, taskPlannedDateKey(currentTask), new Date().toISOString());
      const noteTransfer = await this.transferTaskNotesToAppleReminder(currentTask, reminderId);
      this.settings.appleReminderLinks = {
        ...this.settings.appleReminderLinks,
        [currentTask.id]: reminderId
      };
      await this.saveSettings();

      if (!noteTransfer.ok) {
        new Notice(noteTransfer.message);
        return;
      }

      const deletion = {
        result: {
          status: "conflict",
          message: t("taskUpdateFailed")
        } as CompletionResult
      };
      await this.app.vault.process(file, (latestContent) => {
        deletion.result = deleteTaskInContent(latestContent, currentTask, {
          lineChangedConflict: t("lineChangedConflict"),
          lineMismatchConflict: t("lineMismatchConflict"),
          lineNoLongerOpen: t("lineNoLongerOpen"),
          lineOutsideFile: t("lineOutsideFile")
        });
        return deletion.result.status === "updated" ? deletion.result.content : latestContent;
      });
      if (deletion.result.status === "updated") {
        await this.reindexVaultFile(file);
      }

      await this.syncLocalApple({ silent: true });
      this.clearLastTaskUndoAction();
      if (deletion.result.status === "updated") {
        new Notice(t("appleReminderCreatedAndTaskRemoved"));
      } else if (deletion.result.status === "conflict") {
        new Notice(deletion.result.message);
      }
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async sendTaskToDida(task: TaskItem, target: Extract<TaskSendTarget, { type: "dida" }> = { type: "dida" }): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (!this.canCreateDidaTasks()) {
      new Notice(t("didaCreateDisabled"));
      return;
    }
    if (task.source !== "vault") {
      new Notice(t("didaVaultOnly"));
      return;
    }
    const existingId = this.settings.didaTaskLinks[task.id];
    if (existingId) {
      new Notice(`${t("didaTaskCreated")}: ${existingId}`);
      return;
    }
    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${task.filePath}`);
      return;
    }
    const content = await this.app.vault.read(file);
    const currentTask = parseTaskAtLine({ filePath: task.filePath, content, line: task.line });
    if (!currentTask || currentTask.rawLine !== task.rawLine) {
      new Notice(t("lineChangedConflict"));
      return;
    }
    try {
      const created = await this.createDidaClient().createTask(
        taskItemToDidaPayload({
          title: currentTask.text,
          projectId: target.projectId ?? this.settings.dida.defaultProjectId,
          notes: this.appleReminderNotes(currentTask),
          date: taskPlannedDateKey(currentTask),
          startDate: taskStartDateKey(currentTask) ?? taskPlannedDateKey(currentTask) ?? undefined,
          startMinutes: startMinutesFromTask(currentTask),
          tags: this.settings.dida.tasksCreateTagsEnabled ? currentTask.tags : [],
          reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
          repeatFlag: currentTask.recurrence
        })
      );
      const noteTransfer = await this.transferTaskNotesToUpdatedTask(currentTask, {
        ...currentTask,
        id: `dida:${created.id}`,
        stableId: `dida:${created.id}`,
        source: "dida",
        externalId: created.id,
        externalListId: created.projectId ?? target.projectId ?? this.settings.dida.defaultProjectId,
        externalSourceName: undefined,
        filePath: currentTask.filePath,
        rawLine: currentTask.rawLine
      });
      this.settings.didaTaskLinks = {
        ...this.settings.didaTaskLinks,
        [currentTask.id]: created.id
      };
      await this.saveSettings();

      if (!noteTransfer.ok) {
        new Notice(noteTransfer.message);
        return;
      }

      const deletion = { result: { status: "conflict", message: t("taskUpdateFailed") } as CompletionResult };
      await this.app.vault.process(file, (latestContent) => {
        deletion.result = deleteTaskInContent(latestContent, currentTask, {
          lineChangedConflict: t("lineChangedConflict"),
          lineMismatchConflict: t("lineMismatchConflict"),
          lineNoLongerOpen: t("lineNoLongerOpen"),
          lineOutsideFile: t("lineOutsideFile")
        });
        return deletion.result.status === "updated" ? deletion.result.content : latestContent;
      });
      if (deletion.result.status === "updated") {
        await this.reindexVaultFile(file);
      }
      await this.syncDida({ silent: true });
      this.clearLastTaskUndoAction();
      new Notice(deletion.result.status === "updated" ? t("didaTaskCreatedAndTaskRemoved") : t("didaTaskCreated"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async convertAppleCalendarEventToReminder(event: CalendarEvent): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (
      event.sourceId !== "apple-calendar" ||
      !this.settings.localApple.calendarReminderConversionEnabled ||
      !this.canConvertAppleCalendarAndReminders() ||
      !this.isWritableAppleCalendarEvent(event)
    ) {
      new Notice(t("appleCalendarReminderConversionDisabled"));
      return;
    }

    try {
      await this.writeAppleReminderWithAccessRetry(() =>
        createAppleReminder(appleCalendarEventToReminderInput(event, this.settings.localApple.remindersDefaultListId))
      );
      try {
        await deleteAppleCalendarEvent(event.id);
      } catch (error) {
        await this.syncLocalApple({ silent: true });
        new Notice(`${t("appleCalendarReminderConversionPartial")} ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await this.syncLocalApple({ silent: true });
      this.clearLastTaskUndoAction();
      new Notice(t("appleCalendarReminderConverted"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async convertAppleReminderToCalendarEvent(task: TaskItem): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (
      task.source !== "apple-reminders" ||
      !task.externalId ||
      !this.settings.localApple.calendarReminderConversionEnabled ||
      !this.canConvertAppleCalendarAndReminders()
    ) {
      new Notice(t("appleCalendarReminderConversionDisabled"));
      return;
    }

    try {
      await createAppleCalendarEvent(
        appleReminderToCalendarEventInput(
          task,
          this.settings.localApple.calendarDefaultTimedTaskDurationMinutes,
          this.settings.calendarEventCreationDefaultTarget.type === "apple-calendar"
            ? this.settings.calendarEventCreationDefaultTarget.calendarId
            : undefined
        )
      );
      try {
        const reminderId = task.externalId;
        await this.writeAppleReminderWithAccessRetry(() => deleteAppleReminder(reminderId));
      } catch (error) {
        await this.syncLocalApple({ silent: true });
        new Notice(`${t("appleCalendarReminderConversionPartial")} ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await this.syncLocalApple({ silent: true });
      this.clearLastTaskUndoAction();
      new Notice(t("appleCalendarReminderConverted"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async confirmRiskySourceDeletionSetting(): Promise<boolean> {
    const t = createTranslator(this.settings.language);
    return new Promise((resolve) => {
      new RiskySourceDeletionModal(this, {
        title: t("localAppleRemindersCreateRiskTitle"),
        message: t("localAppleRemindersCreateRiskConfirm"),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      }).open();
    });
  }

  async confirmRiskyAppleConversionSetting(): Promise<boolean> {
    const t = createTranslator(this.settings.language);
    return new Promise((resolve) => {
      new RiskySourceDeletionModal(this, {
        title: t("appleCalendarReminderConversionRiskTitle"),
        message: t("appleCalendarReminderConversionRiskConfirm"),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      }).open();
    });
  }

  async sendEditorTaskToAppleReminders(editor: Editor, view: MarkdownView): Promise<void> {
    const t = createTranslator(this.settings.language);
    const file = view.file;
    if (!file) {
      new Notice(t("fileNotFound"));
      return;
    }

    const task = parseTaskAtLine({
      filePath: file.path,
      content: editor.getValue(),
      line: editor.getCursor().line
    });

    if (!task) {
      new Notice(t("appleReminderNoTaskAtCursor"));
      return;
    }

    await this.sendTaskToAppleReminders(task);
  }

  async moveAppleReminderToList(task: TaskItem, listId: string): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (task.source !== "apple-reminders" || !task.externalId) {
      new Notice(t("externalTaskReadOnly"));
      return;
    }
    if (!this.canCreateAppleReminders()) {
      new Notice(t("appleReminderCreateDisabled"));
      return;
    }
    if (!listId || task.externalListId === listId) return;

    try {
      const reminderId = task.externalId;
      try {
        await this.writeAppleReminderWithAccessRetry(() => setAppleReminderList(reminderId, listId));
      } catch (error) {
        if (!this.isAppleReminderSourceMoveError(error)) throw error;
        const replacementReminderId = await this.recreateAppleReminderInList(task, listId);
        this.rememberAppleReminderListMoveUndo(task, replacementReminderId, task.externalListId);
        this.migrateExternalTaskMetadata(
          this.externalTaskMetadataKey("apple-reminders", reminderId),
          this.externalTaskMetadataKey("apple-reminders", replacementReminderId)
        );
        await this.syncLocalApple({ silent: true });
        this.updateAppleReminderLinks(reminderId, replacementReminderId);
        const noteTransfer = await this.transferTaskNotesToAppleReminder(task, replacementReminderId);
        if (!noteTransfer.ok) new Notice(noteTransfer.message);
        this.refreshOpenViews();
        new Notice(t("appleReminderListUpdated"));
        return;
      }
      await this.syncLocalApple({ silent: true });
      this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
      new Notice(t("appleReminderListUpdated"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async moveDidaTaskToProject(task: TaskItem, projectId: string): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (task.source !== "dida" || !task.externalId || !task.externalListId || !this.settings.dida.tasksWritebackEnabled) {
      new Notice(t("externalTaskReadOnly"));
      return;
    }
    if (!projectId || task.externalListId === projectId) return;
    try {
      await this.createDidaClient().updateTask(
        task.externalListId,
        task.externalId,
        taskItemToDidaPayload({
          title: task.text,
          projectId,
          notes: task.contextPreview,
          date: taskPlannedDateKey(task) ?? null,
          startDate: taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? undefined,
          startMinutes: startMinutesFromTask(task),
          tags: this.settings.dida.tasksCreateTagsEnabled ? task.tags : [],
          reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
          repeatFlag: task.recurrence
        })
      );
      await this.syncDida({ silent: true });
      this.rememberTaskDraftUndo(task, this.resolveUndoTask(task, { status: "updated", content: "", line: 0 }));
      new Notice(t("taskUpdated"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  openCreateTaskModal(target: CalendarDropTarget, options: CreateTaskOptions = {}): void {
    new CreateTaskModal(this, target, options).open();
  }

  async createTaskForDate(
    calendarTarget: CalendarDropTarget,
    text: string,
    target: CalendarCreationTarget = this.defaultCalendarCreationTarget(),
    notes?: string,
    alertMinutesBefore?: number | null,
    recurrence?: string | null,
    recurrenceUntil?: string,
    recurrenceStart?: string,
    options: CreateTaskOptions = {}
  ): Promise<void> {
    const t = createTranslator(this.settings.language);
    const timedTarget = calendarDropTargetParts(calendarTarget);
    const taskText = text.replace(/\s+/g, " ").trim();
    const cleanNotes = notes?.trim() || undefined;
    if (!taskText) return;

    if (target.type === "apple-reminders") {
      if (!this.canCreateAppleReminders()) {
        new Notice(t("appleReminderCreateDisabled"));
        return;
      }
      const reminderText = extractAppleReminderTitleTags(taskText);
      const reminderTags = reminderText.tags;
      const input = {
        title: reminderText.title || taskText,
        ...(cleanNotes ? { notes: cleanNotes } : {}),
        dueDate: timedTarget.dateKey,
        startMinutes: timedTarget.startMinutes,
        ...(timedTarget.startMinutes !== undefined && alertMinutesBefore !== undefined ? { alertMinutesBefore } : {}),
        listId: target.listId ?? this.settings.localApple.remindersDefaultListId,
        tags: reminderTags,
        ...(recurrence ? { recurrence } : {})
      };
      try {
        const reminderId = await this.writeAppleReminderWithAccessRetry(() => createAppleReminder(input));
        this.rememberAppleReminderStartDate(
          reminderId,
          {
            rawLine: "",
            dueDate: timedTarget.dateKey,
            scheduledDate: timedTarget.dateKey,
            startDate: timedTarget.dateKey,
            source: "apple-reminders",
            externalId: reminderId
          },
          timedTarget.dateKey
        );
        await this.syncLocalApple({ silent: true });
        const createdTask = this.localAppleTasks.find((task) => task.externalId === reminderId);
        if (createdTask) options.onTaskCreated?.(createdTask);
        this.clearLastTaskUndoAction();
        new Notice(`${t("appleReminderCreated")}: ${reminderId}`);
      } catch (error) {
        new Notice(this.localAppleErrorMessage(error, "reminders"));
      }
      return;
    }

    if (target.type === "dida") {
      if (!this.canCreateDidaTasks()) {
        new Notice(t("didaCreateDisabled"));
        return;
      }
      const didaText = extractDidaTitleTags(taskText);
      try {
        const created = await this.createDidaClient().createTask(
          taskItemToDidaPayload({
            title: didaText.title || taskText,
            projectId: target.projectId ?? this.settings.dida.defaultProjectId,
            notes: cleanNotes,
            date: timedTarget.dateKey,
            startDate: timedTarget.dateKey,
            startMinutes: timedTarget.startMinutes,
            tags: this.settings.dida.tasksCreateTagsEnabled ? didaText.tags : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: recurrence ?? undefined
          })
        );
        await this.syncDida({ silent: true });
        const createdTask = this.didaTasks.find((task) => task.externalId === created.id);
        if (createdTask) options.onTaskCreated?.(createdTask);
        this.clearLastTaskUndoAction();
        new Notice(`${t("didaTaskCreated")}: ${created.id}`);
      } catch (error) {
        new Notice(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (target.type === "apple-calendar") {
      if (!this.canSendTasksToAppleCalendar()) {
        new Notice(t("appleCalendarCreateDisabled"));
        return;
      }
      const hasSpecificTime = timedTarget.startMinutes !== undefined;
      const durationMinutes = hasSpecificTime ? validCalendarEventDuration(timedTarget.durationMinutes ?? 60) : undefined;
      const eventDates = recurrence
        ? recurrenceDatesBetween(recurrenceStart, recurrence, recurrenceUntil)
        : [timedTarget.dateKey];
      if (recurrence && eventDates.length === 0) {
        new Notice(t("recurrenceEndDateRequired"));
        return;
      }
      try {
        for (const date of eventDates) {
          await createAppleCalendarEvent({
            title: taskText,
            ...(cleanNotes ? { notes: cleanNotes } : {}),
            date,
            ...(hasSpecificTime ? { startMinutes: timedTarget.startMinutes, durationMinutes } : {}),
            calendarId: target.calendarId
          });
        }
        await this.syncLocalApple({ silent: true });
        this.clearLastTaskUndoAction();
        new Notice(t("appleCalendarEventCreated"));
      } catch (error) {
        new Notice(this.localAppleErrorMessage(error, "calendar"));
      }
      return;
    }

    const path = normalizeTaskCreationFilePath(this.settings.taskCreationFilePath);
    await this.ensureParentFolders(path);
    const taskLine = createTaskLine(taskText, timedTarget.dateKey, timedTarget.startMinutes, recurrence);
    let file = this.app.vault.getFileByPath(path);
    if (!file) {
      file = await this.app.vault.create(path, appendTaskToContent("", taskLine));
    } else {
      await this.app.vault.process(file, (content) => appendTaskToContent(content, taskLine));
    }
    await this.reindexVaultFile(file);
    const createdTask = this.findCreatedVaultTask(path, taskLine);
    if (createdTask) options.onTaskCreated?.(createdTask);
    this.clearLastTaskUndoAction();
    new Notice(t("taskCreated"));
  }

  private findCreatedVaultTask(path: string, taskLine: string): TaskItem | undefined {
    const candidates = this.taskIndex.getTasks().filter((task) => task.source === "vault" && task.filePath === path && task.rawLine.trim() === taskLine);
    return candidates.at(-1);
  }

  private defaultCalendarCreationTarget(): CalendarCreationTarget {
    return this.settings.calendarCreationDefaultKind === "event"
      ? this.settings.calendarEventCreationDefaultTarget
      : this.settings.calendarTaskCreationDefaultTarget;
  }

  private registerEditorMenu(): void {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        if (!this.canCreateAppleReminders() || !view.file) return;
        const task = parseTaskAtLine({
          filePath: view.file.path,
          content: editor.getValue(),
          line: editor.getCursor().line
        });
        if (!task) return;

        menu.addItem((item) => {
          item
            .setTitle(createTranslator(this.settings.language)("sendToAppleReminders"))
            .setIcon("bell")
            .onClick(() => {
              void this.sendTaskToAppleReminders(task);
            });
        });
      })
    );
  }

  private appleReminderNotes(task: TaskItem): string {
    return [
      "Created from Task Hub.",
      `Source: ${task.filePath}:${task.line + 1}`,
      task.heading ? `Heading: ${task.heading}` : undefined,
      `Original: ${task.rawLine}`
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async ensureParentFolders(path: string): Promise<void> {
    const parts = path.split("/").slice(0, -1);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getFolderByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async jumpToTask(task: TaskItem): Promise<void> {
    if (task.source !== "vault") {
      const result = openExternalTaskSource(task, (url) => this.app.workspace.containerEl.win.open(url));
      if (result !== "opened") {
        new Notice(`${task.externalSourceName ?? task.filePath}: ${createTranslator(this.settings.language)("externalSourceOpenUnavailable")}`);
      }
      return;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${task.filePath}`);
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, {
      active: true,
      eState: { line: task.line }
    });
    void this.app.workspace.revealLeaf(leaf);

    if (leaf.view instanceof MarkdownView) {
      leaf.view.editor.setCursor({ line: task.line, ch: 0 });
      leaf.view.editor.scrollIntoView(
        {
          from: { line: task.line, ch: 0 },
          to: { line: task.line, ch: 0 }
        },
        true
      );
    } else {
      new Notice(`${t("opened")} ${task.filePath}; ${t("linePositionUnavailable")}`);
    }
  }

  getCalendarEvents(): CalendarEvent[] {
    return [
      ...this.settings.calendarSources.flatMap((source) => (source.enabled ? (source.cachedEvents ?? []) : [])),
      ...(this.isLocalAppleSupported() && this.settings.localApple.enabled && this.settings.localApple.calendarEnabled
        ? this.localAppleEvents.map((event) => this.withAppleCalendarDisplayColor(event))
        : [])
    ];
  }

  getTasks(): TaskItem[] {
    return [
      ...this.taskIndex.getTasks(),
      ...(this.isLocalAppleSupported() && this.settings.localApple.enabled && this.settings.localApple.remindersEnabled ? this.localAppleTasks : []),
      ...(this.settings.dida.enabled && this.settings.dida.tasksEnabled ? this.didaTasks : [])
    ];
  }

  canUndoLastTaskChange(): boolean {
    return Boolean(this.lastTaskUndoAction);
  }

  async undoLastTaskChange(): Promise<boolean> {
    const t = createTranslator(this.settings.language);
    const action = this.lastTaskUndoAction;
    if (!action) {
      new Notice(t("taskUndoUnavailable"));
      return false;
    }

    this.lastTaskUndoAction = undefined;
    this.isUndoingTaskChange = true;
    try {
      const undone = await action.undo();
      if (undone) new Notice(t("taskUndoApplied"));
      return undone;
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      this.isUndoingTaskChange = false;
    }
  }

  notesViewEnabled(): boolean {
    return this.settings.datedNotes.enabled;
  }

  getHubNotes(): HubNote[] {
    return this.notesViewEnabled() ? this.hubNoteIndex.getNotes() : [];
  }

  getTimelineHubNotes(): TimelineHubNote[] {
    return this.notesViewEnabled() ? this.hubNoteIndex.getTimelineNotes() : [];
  }

  getHubNote(path: string): HubNote | undefined {
    return this.hubNoteIndex.getNote(path);
  }

  getHubNotesForTask(task: TaskItem): HubNote[] {
    return this.hubNoteIndex.getNotesForKey(buildTaskNoteKey(task));
  }

  getHubNotesForEvent(event: CalendarEvent): HubNote[] {
    return this.hubNoteIndex.getNotesForKey(buildCalendarEventNoteKey(event));
  }

  getTaskNotes(task: TaskItem): TaskNote[] {
    return this.settings.taskNotes.enabled ? this.getHubNotesForTask(task).map(hubNoteToTaskNote) : [];
  }

  getOrderedTaskNotes(task: TaskItem): TaskNote[] {
    const notes = this.getTaskNotes(task);
    if (notes.length <= 1) return notes;
    const scopeKey = taskNoteOrderScopeKey(task);
    return sortTaskNotes(notes, this.settings.taskNoteManualOrder[scopeKey] ?? [], this.settings.taskNotePinned[scopeKey] ?? []);
  }

  getTaskNoteCount(task: TaskItem): number {
    return this.getTaskNotes(task).length;
  }

  isTaskNotePinned(task: TaskItem, note: TaskNote): boolean {
    return (this.settings.taskNotePinned[taskNoteOrderScopeKey(task)] ?? []).includes(taskNoteOrderItemKey(note));
  }

  async reorderTaskNotes(task: TaskItem, draggedNote: TaskNote, anchorNote: TaskNote, position: TaskListDropPosition): Promise<void> {
    const notes = this.getTaskNotes(task);
    if (notes.length <= 1) return;
    const scopeKey = taskNoteOrderScopeKey(task);
    const nextOrder = cleanupTaskNoteManualOrderEntry(
      notes,
      buildReorderedTaskNoteKeys(notes, this.settings.taskNoteManualOrder, task, draggedNote, anchorNote, position)
    );
    const nextManualOrder = { ...this.settings.taskNoteManualOrder };
    if (nextOrder.length > 0) {
      nextManualOrder[scopeKey] = nextOrder;
    } else {
      delete nextManualOrder[scopeKey];
    }
    if (JSON.stringify(nextManualOrder) === JSON.stringify(this.settings.taskNoteManualOrder)) return;
    this.settings.taskNoteManualOrder = nextManualOrder;
    await this.saveSettings();
  }

  async toggleTaskNotePinned(task: TaskItem, note: TaskNote): Promise<void> {
    const notes = this.getTaskNotes(task);
    if (notes.length === 0) return;
    const scopeKey = taskNoteOrderScopeKey(task);
    const wasPinned = this.isTaskNotePinned(task, note);
    const nextPinnedEntry = cleanupTaskNotePinnedEntry(notes, togglePinnedTaskNote(this.settings.taskNotePinned, task, note));
    const nextPinned = { ...this.settings.taskNotePinned };
    if (nextPinnedEntry.length > 0) {
      nextPinned[scopeKey] = nextPinnedEntry;
    } else {
      delete nextPinned[scopeKey];
    }

    let nextManual = this.settings.taskNoteManualOrder;
    if (!wasPinned) {
      const prioritized = cleanupTaskNoteManualOrderEntry(
        notes,
        prioritizeTaskNoteInManualOrder(notes, this.settings.taskNoteManualOrder, task, note)
      );
      nextManual = { ...this.settings.taskNoteManualOrder };
      if (prioritized.length > 0) {
        nextManual[scopeKey] = prioritized;
      } else {
        delete nextManual[scopeKey];
      }
    }

    if (
      JSON.stringify(nextPinned) === JSON.stringify(this.settings.taskNotePinned) &&
      JSON.stringify(nextManual) === JSON.stringify(this.settings.taskNoteManualOrder)
    ) {
      return;
    }

    this.settings.taskNotePinned = nextPinned;
    this.settings.taskNoteManualOrder = nextManual;
    await this.saveSettings();
  }

  getEventNotes(event: CalendarEvent): TaskNote[] {
    return this.settings.taskNotes.enabled ? this.getHubNotesForEvent(event).map(hubNoteToTaskNote) : [];
  }

  private clearLastTaskUndoAction(): void {
    if (this.isUndoingTaskChange) return;
    this.lastTaskUndoAction = undefined;
  }

  private rememberTaskCompletionUndo(originalTask: TaskItem, updatedTask: TaskItem | undefined): void {
    if (this.isUndoingTaskChange || !updatedTask) return;
    if (originalTask.source === "vault" && Boolean(originalTask.recurrence)) {
      this.lastTaskUndoAction = undefined;
      return;
    }

    this.lastTaskUndoAction = {
      undo: async () => {
        const currentTask = this.findTaskForUndo(updatedTask) ?? updatedTask;
        const result = await this.completeTask(currentTask);
        return result.status === "updated";
      }
    };
  }

  private rememberTaskDraftUndo(originalTask: TaskItem, updatedTask: TaskItem | undefined): void {
    if (this.isUndoingTaskChange || !updatedTask) return;
    const draft = this.undoDraftFromTask(originalTask);
    this.lastTaskUndoAction = {
      undo: async () => {
        const currentTask = this.findTaskForUndo(updatedTask) ?? updatedTask;
        const result = await this.updateCalendarTask(currentTask, draft);
        return result.status === "updated" || result.status === "already_in_state";
      }
    };
  }

  private rememberAppleReminderListMoveUndo(originalTask: TaskItem, replacementReminderId: string, originalListId: string | undefined): void {
    if (this.isUndoingTaskChange || !originalListId) return;
    this.lastTaskUndoAction = {
      undo: async () => {
        const currentTask = this.getTasks().find((candidate) => candidate.source === "apple-reminders" && candidate.externalId === replacementReminderId);
        if (!currentTask) return false;
        await this.moveAppleReminderToList(currentTask, originalListId);
        return true;
      }
    };
  }

  private updateAppleReminderLinks(previousReminderId: string, nextReminderId: string): void {
    let changed = false;
    const nextLinks = Object.fromEntries(Object.entries(this.settings.appleReminderLinks).map(([taskId, reminderId]) => {
      if (reminderId !== previousReminderId) return [taskId, reminderId];
      changed = true;
      return [taskId, nextReminderId];
    }));
    if (changed) {
      this.settings.appleReminderLinks = nextLinks;
      void this.saveSettings();
    }
  }

  private async recreateAppleReminderInList(task: TaskItem, listId: string): Promise<string> {
    const replacementReminderId = await this.writeAppleReminderWithAccessRetry(() => createAppleReminder({
      title: task.text,
      notes: task.contextPreview,
      dueDate: taskPlannedDateKey(task),
      listId,
      startMinutes: startMinutesFromTask(task),
      alertMinutesBefore: startMinutesFromTask(task) !== undefined ? task.alertMinutesBefore ?? null : null,
      tags: this.settings.localApple.remindersCreateTagsEnabled ? normalizeAppleReminderTags(task.tags) : [],
      recurrence: task.recurrence ?? null
    }));
    try {
      await this.writeAppleReminderWithAccessRetry(() => deleteAppleReminder(task.externalId as string));
    } catch (error) {
      throw new Error(`Created the reminder in the target list, but could not remove the original one: ${error instanceof Error ? error.message : String(error)}`);
    }
    return replacementReminderId;
  }

  private async recreateAppleReminderFromDraft(
    task: TaskItem,
    draft: Extract<CalendarItemEditDraft, { kind: "task" }>,
    title: string,
    tags: string[],
    recurrence: string | null | undefined
  ): Promise<string> {
    const replacementReminderId = await this.writeAppleReminderWithAccessRetry(() => createAppleReminder({
      title,
      notes: draft.notes,
      dueDate: draft.date || undefined,
      listId: draft.reminderListId || undefined,
      startMinutes: draft.startTime ? parseTimeInputValue(draft.startTime) : undefined,
      alertMinutesBefore: draft.startTime ? draft.alertMinutesBefore ?? null : null,
      tags,
      recurrence: recurrence ?? null
    }));
    try {
      await this.writeAppleReminderWithAccessRetry(() => deleteAppleReminder(task.externalId as string));
    } catch (error) {
      throw new Error(`Created the reminder in the target list, but could not remove the original one: ${error instanceof Error ? error.message : String(error)}`);
    }
    return replacementReminderId;
  }

  private resolveUndoTask(task: TaskItem, result: CompletionResult): TaskItem | undefined {
    if (task.source === "vault") {
      if (result.status !== "updated" || !result.content) return undefined;
      return parseTaskAtLine({
        filePath: task.filePath,
        content: result.content,
        line: result.line
      });
    }

    return task.externalId
      ? this.getTasks().find((candidate) => candidate.source === task.source && candidate.externalId === task.externalId)
      : undefined;
  }

  private rememberReindexedVaultTaskStableId(task: TaskItem, result: CompletionResult): void {
    if (
      task.source !== "vault" ||
      result.status !== "updated" ||
      !result.content ||
      !this.taskIndex ||
      typeof this.taskIndex.rememberStableIdForTask !== "function"
    ) {
      return;
    }
    const updatedTask = parseTaskAtLine({
      filePath: task.filePath,
      content: result.content,
      line: result.line
    });
    if (!updatedTask) return;
    this.taskIndex.rememberStableIdForTask(updatedTask, task.stableId ?? task.id);
  }

  private findTaskForUndo(task: TaskItem): TaskItem | undefined {
    return this.getTasks().find((candidate) => {
      if (candidate.source !== task.source) return false;
      if (task.externalId) return candidate.externalId === task.externalId;
      return candidate.filePath === task.filePath && candidate.rawLine === task.rawLine;
    });
  }

  private undoDraftFromTask(task: TaskItem): Extract<CalendarItemEditDraft, { kind: "task" }> {
    const startMinutes = startMinutesFromTask(task);
    return {
      kind: "task",
      title: task.text,
      date: taskPlannedDateKey(task) ?? "",
      startTime: startMinutes === undefined ? "" : timeInputValue(startMinutes),
      tags: [...task.tags],
      reminderListId: task.externalListId,
      notes: task.contextPreview,
      alertMinutesBefore: task.alertMinutesBefore ?? null,
      recurrence: task.recurrence ?? null
    };
  }

  async openTaskNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    const hubNote = this.getHubNote(path);
    if (hubNote?.date) {
      await this.openDatedNoteEditor(path);
      return;
    }
    new TaskNoteModal(this, file, "edit").open();
  }

  async openTaskNoteSource(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
    void this.app.workspace.revealLeaf(leaf);
  }

  getDatedNotes(): DatedNote[] {
    return this.notesViewEnabled() ? this.datedNoteIndex.getNotes() : [];
  }

  async openDatedNoteSource(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
    void this.app.workspace.revealLeaf(leaf);
  }

  async openDatedNoteEditor(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    const note = this.getHubNote(path) ?? this.datedNoteIndex.getNotes().find((candidate) => candidate.path === path);
    new DatedNoteEditModal(this, file, note?.body ?? "").open();
  }

  async createDatedNote(dateKey: string, body?: string): Promise<DatedNote | undefined> {
    const t = createTranslator(this.settings.language);
    if (!this.notesViewEnabled()) {
      new Notice(t("datedNotesDisabled"));
      return undefined;
    }
    const now = new Date();
    const noteBody = (body ?? "").trim();
    const noteTitle = datedNoteTitleFromBody(noteBody) ?? applyDatedNoteTitleTemplate(this.settings.datedNotes.defaultTitleTemplate, dateKey);
    const folder = preferredUnifiedNoteFolder(this.settings, "dated");
    const path = await this.uniqueTaskNotePath(`${folder}/${datedNoteFileName(noteTitle, dateKey, now)}`);
    await this.ensureParentFolders(path);
    const noteId = createHubNoteId(now);
    const file = await this.app.vault.create(
      path,
      createHubNoteContent({
        noteId,
        kind: "manual",
        date: dateKey,
        title: noteTitle,
        createdAt: now.toISOString(),
        body: noteBody,
        addThinoIdToTaskHubNotes:
          this.settings.taskNotes.thinoIntegrationEnabled && this.settings.taskNotes.addThinoIdToTaskHubNotes
      })
    );
    await this.datedNoteIndex.reindexFile(this.toIndexableFile(file));
    await this.hubNoteIndex.reindexFile(this.toIndexableFile(file));
    const createdNote = this.datedNoteIndex.getNotes().find((note) => note.path === file.path);
    this.refreshOpenViews();
    new Notice(t("datedNoteCreated"));
    if (createdNote && this.settings.datedNotes.openAfterCreate) {
      await this.openDatedNoteEditor(createdNote.path);
    }
    return createdNote;
  }

  async saveDatedNoteBody(file: TFile, body: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const t = createTranslator(this.settings.language);
    const update = {
      result: { status: "conflict", message: t("taskUpdateFailed") } as ReturnType<typeof replaceHubNoteBody>
    };
    await this.app.vault.process(file, (content) => {
      update.result = replaceHubNoteBody(content, body, new Date().toISOString());
      return update.result.status === "updated" ? update.result.content : content;
    });
    if (update.result.status !== "updated") {
      return { ok: false, message: update.result.message };
    }
    await this.datedNoteIndex.reindexFile(this.toIndexableFile(file));
    await this.hubNoteIndex.reindexFile(this.toIndexableFile(file));
    this.refreshOpenViews();
    return { ok: true };
  }

  async deleteDatedNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    await this.app.fileManager.trashFile(file);
    this.datedNoteIndex.removeFile(path);
    this.hubNoteIndex.removeFile(path);
    this.refreshOpenViews();
    new Notice(t("datedNoteDeleted"));
  }

  async deleteTaskNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    await this.app.fileManager.trashFile(file);
    this.taskNoteIndex.removeFile(path);
    this.hubNoteIndex.removeFile(path);
    this.refreshOpenViews();
    new Notice(t("taskNoteDeleted"));
  }

  async createTaskNoteForTask(task: TaskItem): Promise<void> {
    await this.createTaskNote(buildTaskNoteKey(task), task.text, relatedTimelineDateForTask(task));
  }

  async createTaskNoteForEvent(event: CalendarEvent): Promise<void> {
    await this.createTaskNote(buildCalendarEventNoteKey(event), event.title, event.start.slice(0, 10));
  }

  async saveTaskNoteBody(file: TFile, body: string): Promise<{ ok: true; deleted?: boolean } | { ok: false; message: string }> {
    const t = createTranslator(this.settings.language);
    if (!body.trim()) {
      await this.deleteTaskNoteFile(file);
      return { ok: true, deleted: true };
    }
    const update = {
      result: { status: "conflict", message: t("taskUpdateFailed") } as ReturnType<typeof replaceHubNoteBody>
    };
    await this.app.vault.process(file, (content) => {
      update.result = replaceHubNoteBody(content, body, new Date().toISOString());
      return update.result.status === "updated" ? update.result.content : content;
    });
    if (update.result.status !== "updated") {
      return { ok: false, message: update.result.message };
    }
    await this.taskNoteIndex.reindexFile(this.toIndexableFile(file));
    await this.hubNoteIndex.reindexFile(this.toIndexableFile(file));
    this.refreshOpenViews();
    return { ok: true };
  }

  async deleteTaskNoteIfEmpty(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.cachedRead(file);
      if (noteBodyFromContent(content).trim()) return;
      await this.deleteTaskNoteFile(file);
    } catch {
      // The note may already have been deleted while the modal was closing.
    }
  }

  async reindexTaskNoteFile(file: TFile): Promise<void> {
    await this.taskNoteIndex.reindexFile(this.toIndexableFile(file));
    this.refreshOpenViews();
  }

  refreshTaskHubViews(): void {
    this.refreshOpenViews();
  }

  getCalendarSources() {
    const appleStatus = this.localAppleSourceStatus();
    const sources = [...this.settings.calendarSources];
    if (this.isLocalAppleSupported() && this.settings.localApple.enabled && this.settings.localApple.calendarEnabled) {
      const appleCalendars = this.settings.localApple.calendars;
      if (appleCalendars.length > 0) {
        for (const calendar of appleCalendars) {
          sources.push(
            appleCalendarSource(
              this.appleCalendarDisplayColor(calendar),
              this.appleCalendarSourceStatus(calendar.id, appleStatus.calendar),
              `apple-calendar:${calendar.id}`,
              `${createTranslator(this.settings.language)("localAppleCalendar")} / ${calendar.name}`
            )
          );
        }
      } else {
        sources.push(appleCalendarSource(this.settings.localApple.calendarColor, appleStatus.calendar));
      }
    }
    if (this.isLocalAppleSupported() && this.settings.localApple.enabled && this.settings.localApple.remindersEnabled) {
      sources.push(appleRemindersSource(this.settings.localApple.remindersColor, appleStatus.reminders));
    }
    if (this.settings.dida.enabled && this.settings.dida.tasksEnabled) {
      sources.push(didaSource(this.settings.dida.tasksColor, this.settings.dida.syncStatus));
    }
    return sources;
  }

  async syncExternalTasks(options: { silent?: boolean } = {}): Promise<void> {
    await Promise.all([this.syncLocalApple(options), this.syncDida(options)]);
  }

  private applyExternalTaskWindow(tasks: TaskItem[], now = new Date()): TaskItem[] {
    return tasks.filter((task) => {
      const anchorDate = taskWindowDateKey(task);
      if (!anchorDate) return !task.completed;
      return isDateKeyWithinWindow(
        anchorDate,
        now,
        this.settings.externalTaskLookbackDays,
        this.settings.externalTaskLookaheadDays
      );
    });
  }

  private externalTaskMetadataKey(source: TaskItem["source"], externalId: string): string {
    return `${source}:${externalId}`;
  }

  private mergeExternalTaskMetadata(task: TaskItem): TaskItem {
    if (!task.externalId) return task;
    const metadata = this.settings.externalTaskMetadata[this.externalTaskMetadataKey(task.source, task.externalId)];
    if (!metadata?.startDate || task.startDate) return task;
    return {
      ...task,
      startDate: metadata.startDate
    };
  }

  private touchExternalTaskMetadata(stableId: string, input: { startDate?: string; seenAt: string; overwriteStartDate?: boolean }): void {
    const current = this.settings.externalTaskMetadata[stableId];
    const nextStartDate =
      input.overwriteStartDate
        ? input.startDate
        : current?.startDate ?? input.startDate;
    if (!nextStartDate && current?.lastSeenAt === input.seenAt) return;
    this.settings.externalTaskMetadata = {
      ...this.settings.externalTaskMetadata,
      [stableId]: {
        ...(nextStartDate ? { startDate: nextStartDate } : {}),
        lastSeenAt: input.seenAt
      }
    };
  }

  private migrateExternalTaskMetadata(previousStableId: string, nextStableId: string): void {
    if (previousStableId === nextStableId) return;
    const current = this.settings.externalTaskMetadata[previousStableId];
    if (!current) return;
    const nextMetadata = { ...this.settings.externalTaskMetadata };
    nextMetadata[nextStableId] = {
      ...(nextMetadata[nextStableId] ?? {}),
      ...current
    };
    delete nextMetadata[previousStableId];
    this.settings.externalTaskMetadata = nextMetadata;
  }

  private rememberAppleReminderStartDate(externalId: string, task: Pick<TaskItem, "source" | "externalId" | "startDate" | "scheduledDate" | "dueDate" | "rawLine">, fallbackDate: string | undefined, seenAt = new Date().toISOString()): void {
    if (!externalId) return;
    const stableId = this.externalTaskMetadataKey("apple-reminders", externalId);
    const startDate = taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? fallbackDate;
    this.touchExternalTaskMetadata(stableId, { startDate, seenAt });
  }

  private clearAppleReminderStartDate(externalId: string | undefined): void {
    if (!externalId) return;
    const stableId = this.externalTaskMetadataKey("apple-reminders", externalId);
    const current = this.settings.externalTaskMetadata[stableId];
    if (!current?.startDate) return;
    const nextMetadata = { ...this.settings.externalTaskMetadata };
    const nextRecord = { ...current };
    delete nextRecord.startDate;
    if (nextRecord.lastSeenAt) {
      nextMetadata[stableId] = nextRecord;
    } else {
      delete nextMetadata[stableId];
    }
    this.settings.externalTaskMetadata = nextMetadata;
  }

  private pruneExternalTaskMetadata(liveStableIds: Set<string>, now = new Date()): boolean {
    let changed = false;
    const nextMetadata: TaskHubSettings["externalTaskMetadata"] = {};
    for (const [stableId, metadata] of Object.entries(this.settings.externalTaskMetadata)) {
      if (!stableId.startsWith("apple-reminders:")) {
        nextMetadata[stableId] = metadata;
        continue;
      }
      if (liveStableIds.has(stableId)) {
        nextMetadata[stableId] = metadata;
        continue;
      }
      const lastSeenAt = metadata.lastSeenAt;
      if (!lastSeenAt) {
        changed = true;
        continue;
      }
      const lastSeen = new Date(lastSeenAt);
      if (Number.isNaN(lastSeen.getTime())) {
        changed = true;
        continue;
      }
      if (
        isDateKeyWithinWindow(
          `${lastSeen.getFullYear()}-${String(lastSeen.getMonth() + 1).padStart(2, "0")}-${String(lastSeen.getDate()).padStart(2, "0")}`,
          now,
          this.settings.externalTaskLookbackDays,
          this.settings.externalTaskLookaheadDays
        )
      ) {
        nextMetadata[stableId] = metadata;
      } else {
        changed = true;
      }
    }
    if (!changed && JSON.stringify(nextMetadata) === JSON.stringify(this.settings.externalTaskMetadata)) return false;
    this.settings.externalTaskMetadata = nextMetadata;
    return true;
  }

  async syncDida(options: { silent?: boolean } = {}): Promise<void> {
    const t = createTranslator(this.settings.language);
    const enabled = this.settings.dida.enabled && this.settings.dida.tasksEnabled;
    if (!enabled) {
      this.didaTasks = [];
      this.settings.dida.syncStatus = { state: "never" };
      if (this.cleanupTaskListManualOrderState()) await this.saveData(this.settings);
      this.refreshOpenViews();
      return;
    }
    const attemptedAt = new Date().toISOString();
    if (!this.settings.dida.apiToken.trim()) {
      const message = t("didaApiTokenDesc");
      this.didaTasks = [];
      this.settings.dida.syncStatus = { state: "error", errorType: "local_error", message, lastAttemptAt: attemptedAt };
      if (!options.silent) new Notice(`${t("failedSync")} ${t("dida")}: ${message}`);
      if (this.cleanupTaskListManualOrderState()) await this.saveData(this.settings);
      this.refreshOpenViews();
      return;
    }
    try {
      const client = this.createDidaClient();
      const projects = didaProjectsFromRecords(await client.listProjects());
      const [inboxData, ...data] = await Promise.all([
        client.getInboxData(),
        ...projects.map((project) => client.getProjectData(project.id))
      ]);
      const inboxProjectId = inboxData.tasks?.find((task) => task.projectId)?.projectId ?? "inbox";
      const allProjects = [{ id: inboxProjectId, name: DIDA_INBOX_PROJECT_NAME }, ...projects];
      this.settings.dida.projects = allProjects;
      this.didaTasks = data.flatMap((projectData) => {
        const projectId = projectData.project?.id ?? projectData.tasks?.find((task) => task.projectId)?.projectId;
        const project = allProjects.find((candidate) => candidate.id === projectId) ?? { id: projectId ?? "unknown", name: DIDA_INBOX_PROJECT_NAME };
        return (projectData.tasks ?? []).map((task, index) => didaTaskToTaskItem({ ...task, projectId: task.projectId || project.id }, project, index));
      });
      this.didaTasks = [
        ...(inboxData.tasks ?? []).map((task, index) => didaTaskToTaskItem({ ...task, projectId: task.projectId || inboxProjectId }, allProjects[0], index)),
        ...this.didaTasks
      ];
      this.didaTasks = this.applyExternalTaskWindow(this.didaTasks);
      this.settings.dida.syncStatus = { state: "ok", lastSyncedAt: attemptedAt, eventCount: this.didaTasks.length };
      await this.saveSettings();
      if (!options.silent) new Notice(`${t("synced")} ${t("dida")}: ${this.didaTasks.length} ${t("tasks")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.didaTasks = [];
      this.settings.dida.syncStatus = { state: "error", errorType: "local_error", message, lastAttemptAt: attemptedAt };
      await this.saveSettings();
      if (!options.silent) new Notice(`${t("failedSync")} ${t("dida")}: ${message}`);
    }
    this.refreshOpenViews();
  }

  private createDidaClient(): DidaClient {
    return new DidaClient({
      apiBase: this.settings.dida.apiBase,
      apiToken: this.settings.dida.apiToken,
      request: async (request) => {
        const response = await requestUrl({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          throw: false
        });
        return {
          status: response.status,
          text: response.text
        };
      }
    });
  }

  async syncLocalApple(options: { silent?: boolean } = {}): Promise<void> {
    const enabled =
      this.settings.localApple.enabled &&
      (this.settings.localApple.remindersEnabled || this.settings.localApple.calendarEnabled);
    if (!enabled) {
      this.localAppleTasks = [];
      this.localAppleEvents = [];
      this.localAppleStatus = { state: "never" };
      if (this.cleanupTaskListManualOrderState()) await this.saveData(this.settings);
      this.refreshOpenViews();
      return;
    }

    const attemptedAt = new Date().toISOString();
    const t = createTranslator(this.settings.language);
    if (!this.isLocalAppleSupported()) {
      const message = t("localAppleUnsupportedPlatform");
      const status = localAppleErrorStatus(message, attemptedAt);
      this.localAppleTasks = [];
      this.localAppleEvents = [];
      this.localAppleStatus = {
        state: "error",
        lastAttemptAt: attemptedAt,
        message,
        reminders: status,
        calendar: status
      };
      if (!options.silent) {
        new Notice(`${t("failedSync")} ${t("localApple")}: ${this.localAppleStatus.message}`);
      }
      if (this.cleanupTaskListManualOrderState()) await this.saveData(this.settings);
      this.refreshOpenViews();
      return;
    }

    const [remindersResult, calendarResult] = await Promise.all([
      this.settings.localApple.remindersEnabled
        ? settleLocalAppleSource(() => readAppleRemindersData())
        : Promise.resolve({ ok: true as const, value: [] as TaskItem[] }),
      this.settings.localApple.calendarEnabled
        ? settleLocalAppleSource(() => {
            const now = new Date();
            const from = new Date(now);
            from.setDate(from.getDate() - this.settings.localApple.calendarLookbackDays);
            const to = new Date(now);
            to.setDate(to.getDate() + this.settings.localApple.calendarLookaheadDays);
            return readAppleCalendarEventsData(from, to);
          })
        : Promise.resolve({ ok: true as const, value: [] as CalendarEvent[] })
    ]);

    const reminderListsResult = this.settings.localApple.remindersEnabled
      ? await settleLocalAppleSource(() => readAppleReminderLists())
      : { ok: true as const, value: [] };
    const calendarListsResult = this.settings.localApple.calendarEnabled
      ? await settleLocalAppleSource(() => readAppleCalendarLists())
      : { ok: true as const, value: [] };

    if (remindersResult.ok && this.settings.localApple.remindersEnabled) {
      const reminderStableIds = new Set<string>();
      for (const task of remindersResult.value) {
        if (!task.externalId) continue;
        const stableId = this.externalTaskMetadataKey("apple-reminders", task.externalId);
        reminderStableIds.add(stableId);
        this.touchExternalTaskMetadata(stableId, {
          startDate: task.startDate ?? taskPlannedDateKey(task),
          seenAt: attemptedAt
        });
      }
      this.pruneExternalTaskMetadata(reminderStableIds, new Date(attemptedAt));
      this.localAppleTasks = this.applyExternalTaskWindow(remindersResult.value.map((task) => this.mergeExternalTaskMetadata(task)));
    } else {
      this.localAppleTasks = [];
    }

    if (reminderListsResult.ok) {
      this.settings.localApple.remindersLists = reminderListsResult.value;
    }

    if (calendarResult.ok) {
      this.localAppleEvents = calendarResult.value;
    } else {
      this.localAppleEvents = [];
    }

    if (calendarListsResult.ok) {
      this.settings.localApple.calendars = mergeAppleCalendarInfo(calendarListsResult.value, appleCalendarsFromEvents(this.localAppleEvents));
    } else if (calendarResult.ok) {
      this.settings.localApple.calendars = appleCalendarsFromEvents(calendarResult.value);
    }

    const remindersStatus: CalendarSourceStatus = remindersResult.ok
      ? { state: "ok", lastSyncedAt: attemptedAt, eventCount: this.localAppleTasks.length }
      : localAppleErrorStatus(remindersResult.error, attemptedAt);
    const calendarStatus: CalendarSourceStatus = calendarResult.ok
      ? { state: "ok", lastSyncedAt: attemptedAt, eventCount: this.localAppleEvents.length }
      : localAppleErrorStatus(calendarResult.error, attemptedAt);
    const failures = uniqueMessages([
      remindersResult.ok ? undefined : remindersResult.error,
      calendarResult.ok ? undefined : calendarResult.error,
      reminderListsResult.ok ? undefined : reminderListsResult.error,
      calendarListsResult.ok ? undefined : calendarListsResult.error
    ]);

    if (failures.length > 0) {
      this.localAppleStatus = {
        state: "error",
        lastAttemptAt: attemptedAt,
        message: failures.join(" | "),
        reminders: remindersStatus,
        calendar: calendarStatus
      };
      if (!options.silent) {
        new Notice(`${t("failedSync")} ${t("localApple")}: ${this.localAppleStatus.message}`);
      }
    } else {
      this.localAppleStatus = {
        state: "ok",
        lastSyncedAt: attemptedAt,
        itemCount: this.localAppleTasks.length + this.localAppleEvents.length,
        reminders: remindersStatus,
        calendar: calendarStatus
      };
      if (!options.silent) {
        new Notice(`${t("synced")} ${t("localApple")}: ${this.localAppleStatus.itemCount}`);
      }
    }
    if (this.cleanupTaskListManualOrderState()) await this.saveData(this.settings);
    this.refreshOpenViews();
  }

  async refreshLocalAppleStatus(): Promise<void> {
    const attemptedAt = new Date().toISOString();
    if (!this.isLocalAppleSupported()) {
      this.setLocalAppleUnsupportedStatus(attemptedAt);
      this.notifyLocalAppleUnsupported();
      this.refreshOpenViews();
      return;
    }
    try {
      this.localAppleStatus = localAppleStatusFromHelper(await getLocalAppleHelperStatus(), attemptedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = localAppleErrorStatus(message, attemptedAt);
      this.localAppleStatus = {
        state: "error",
        lastAttemptAt: attemptedAt,
        message,
        reminders: status,
        calendar: status
      };
    }
    this.refreshOpenViews();
  }

  async requestLocalApplePermissions(): Promise<void> {
    const attemptedAt = new Date().toISOString();
    if (!this.isLocalAppleSupported()) {
      this.setLocalAppleUnsupportedStatus(attemptedAt);
      this.notifyLocalAppleUnsupported();
      this.refreshOpenViews();
      return;
    }
    try {
      this.localAppleStatus = localAppleStatusFromHelper(
        await requestLocalAppleAccess({
          reminders: this.settings.localApple.remindersEnabled,
          calendar: this.settings.localApple.calendarEnabled
        }),
        attemptedAt
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = localAppleErrorStatus(message, attemptedAt);
      this.localAppleStatus = {
        state: "error",
        lastAttemptAt: attemptedAt,
        message,
        reminders: status,
        calendar: status
      };
    }
    this.refreshOpenViews();
  }

  private localAppleSourceStatus() {
    return {
      calendar: this.localAppleStatus.calendar ?? { state: "never" as const },
      reminders: this.localAppleStatus.reminders ?? { state: "never" as const }
    };
  }

  private withAppleCalendarDisplayColor(event: CalendarEvent): CalendarEvent {
    if (event.sourceId !== "apple-calendar" || !event.calendarId) return event;
    return {
      ...event,
      calendarColor: this.appleCalendarDisplayColor({
        id: event.calendarId,
        name: event.calendarName ?? event.calendarId,
        color: event.calendarColor
      })
    };
  }

  private appleCalendarDisplayColor(calendar: AppleCalendarInfo): string {
    return this.settings.localApple.calendarColorOverrides[calendar.id] ?? calendar.color ?? this.settings.localApple.calendarColor;
  }

  private isWritableAppleCalendarEvent(event: CalendarEvent): boolean {
    if (event.sourceId !== "apple-calendar") return false;
    if (!event.calendarId) return true;
    return this.settings.localApple.calendars.find((calendar) => calendar.id === event.calendarId)?.writable !== false;
  }

  private appleCalendarSourceStatus(calendarId: string, status: CalendarSourceStatus): CalendarSourceStatus {
    if (status.state !== "ok") return status;
    return {
      ...status,
      eventCount: this.localAppleEvents.filter((event) => event.calendarId === calendarId).length
    };
  }

  private setLocalAppleUnsupportedStatus(attemptedAt: string): void {
    const message = createTranslator(this.settings.language)("localAppleUnsupportedPlatform");
    const status = localAppleErrorStatus(message, attemptedAt);
    this.localAppleTasks = [];
    this.localAppleEvents = [];
    this.localAppleStatus = {
      state: "error",
      lastAttemptAt: attemptedAt,
      message,
      reminders: status,
      calendar: status
    };
  }

  async syncCalendarSource(sourceId: string): Promise<void> {
    const source = this.settings.calendarSources.find((candidate) => candidate.id === sourceId);
    const t = createTranslator(this.settings.language);
    if (!source) return;

    const result = await fetchIcsSource(source, async (url) => {
      const response = await requestUrl({ url, throw: false });
      return {
        status: response.status,
        headers: response.headers,
        text: response.text
      };
    });

    source.status = result.status;
    if (result.status.state === "ok") {
      source.cachedEvents = result.events;
      new Notice(`${t("synced")} ${source.name}: ${result.events.length} ${t("events")}.`);
    } else {
      new Notice(`${t("failedSync")} ${source.name}: ${result.status.message}`);
    }

    await this.saveSettings();
  }

  private createTaskIndex(): TaskIndex {
    return new TaskIndex({
      ignoredPaths: this.settings.ignoredPaths,
      readFile: (file) => {
        const vaultFile = this.app.vault.getFileByPath(file.path);
        if (!vaultFile) throw new Error(`File not found: ${file.path}`);
        return this.app.vault.cachedRead(vaultFile);
      },
      loadPersistedTaskState: (path) => this.settings.vaultTaskStableState[path],
      savePersistedTaskState: (path, records) => {
        this.settings.vaultTaskStableState = {
          ...this.settings.vaultTaskStableState,
          [path]: records
        };
      },
      deletePersistedTaskState: (path) => {
        if (!this.settings.vaultTaskStableState[path]) return;
        const rest = { ...this.settings.vaultTaskStableState };
        delete rest[path];
        this.settings.vaultTaskStableState = rest;
      }
    });
  }

  private createTaskNoteIndex(): TaskNoteIndex {
    return new TaskNoteIndex({
      ignoredPaths: this.settings.ignoredPaths,
      readFile: (file) => {
        const vaultFile = this.app.vault.getFileByPath(file.path);
        if (!vaultFile) throw new Error(`File not found: ${file.path}`);
        return this.app.vault.cachedRead(vaultFile);
      }
    });
  }

  private createDatedNoteIndex(): DatedNoteIndex {
    return new DatedNoteIndex({
      ignoredPaths: this.settings.ignoredPaths,
      readFile: (file) => {
        const vaultFile = this.app.vault.getFileByPath(file.path);
        if (!vaultFile) throw new Error(`File not found: ${file.path}`);
        return this.app.vault.cachedRead(vaultFile);
      }
    });
  }

  private createHubNoteIndex(): HubNoteIndex {
    return new HubNoteIndex({
      ignoredPaths: this.settings.ignoredPaths,
      readFile: (file) => {
        const vaultFile = this.app.vault.getFileByPath(file.path);
        if (!vaultFile) throw new Error(`File not found: ${file.path}`);
        return this.app.vault.cachedRead(vaultFile);
      }
    });
  }

  private async transferTaskNotesToAppleReminder(
    task: TaskItem,
    reminderId: string
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.settings.taskNotes.enabled) return { ok: true };
    const fromKey = buildTaskNoteKey(task);
    const toKey = `task:apple-reminders:${reminderId}`;
    const notes = this.taskNoteIndex.getNotesForKey(fromKey);
    if (notes.length === 0) return { ok: true };

    const updatedAt = new Date().toISOString();
    for (const note of notes) {
      const noteFile = this.app.vault.getFileByPath(note.path);
      if (!noteFile) {
        return { ok: false, message: `Task note file not found: ${note.path}` };
      }
      const transfer = {
        result: { status: "conflict", message: "Task note transfer failed." } as ReturnType<
          typeof transferTaskNoteRelationship
        >
      };
      await this.app.vault.process(noteFile, (content) => {
        transfer.result = transferTaskNoteRelationship(content, { fromKey, toKey, updatedAt });
        return transfer.result.status === "updated" ? transfer.result.content : content;
      });
      if (transfer.result.status !== "updated") {
        return { ok: false, message: transfer.result.message };
      }
      await this.taskNoteIndex.reindexFile(this.toIndexableFile(noteFile));
      await this.hubNoteIndex.reindexFile(this.toIndexableFile(noteFile));
    }
    return { ok: true };
  }

  private async transferTaskNotesToUpdatedTask(
    fromTask: TaskItem,
    toTask: TaskItem
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!this.settings.taskNotes.enabled) return { ok: true };
    const fromKey = buildTaskNoteKey(fromTask);
    const toKey = buildTaskNoteKey(toTask);
    if (fromKey === toKey) return { ok: true };

    const notes = this.taskNoteIndex.getNotesForKey(fromKey);
    if (notes.length === 0) return { ok: true };

    const updatedAt = new Date().toISOString();
    for (const note of notes) {
      const noteFile = this.app.vault.getFileByPath(note.path);
      if (!noteFile) {
        return { ok: false, message: `Task note file not found: ${note.path}` };
      }
      const transfer = {
        result: { status: "conflict", message: "Task note transfer failed." } as ReturnType<
          typeof transferTaskNoteRelationship
        >
      };
      await this.app.vault.process(noteFile, (content) => {
        transfer.result = transferTaskNoteRelationship(content, { fromKey, toKey, updatedAt });
        return transfer.result.status === "updated" ? transfer.result.content : content;
      });
      if (transfer.result.status !== "updated") {
        return { ok: false, message: transfer.result.message };
      }
      await this.taskNoteIndex.reindexFile(this.toIndexableFile(noteFile));
      await this.hubNoteIndex.reindexFile(this.toIndexableFile(noteFile));
    }
    return { ok: true };
  }

  private async createTaskNote(relatedKey: string, title: string, date?: string): Promise<void> {
    const t = createTranslator(this.settings.language);
    if (!this.settings.taskNotes.enabled) {
      new Notice(t("taskNotesDisabled"));
      return;
    }
    const now = new Date();
    const mode =
      this.settings.taskNotes.thinoIntegrationEnabled && this.settings.taskNotes.defaultMode === "thino-multi-file"
        ? "thino-multi-file"
        : "task-hub";
    const folder =
      mode === "thino-multi-file"
        ? normalizeTaskNoteFolder(this.settings.taskNotes.thinoFolder, DEFAULT_SETTINGS.taskNotes.thinoFolder)
        : preferredUnifiedNoteFolder(this.settings, "task");
    const path = await this.uniqueTaskNotePath(`${folder}/${taskNoteFileName(title, now, mode)}`);
    await this.ensureParentFolders(path);
    const noteId = createHubNoteId(now);
    const file = await this.app.vault.create(
      path,
      createHubNoteContent({
        noteId,
        kind: "task-related",
        title,
        createdAt: now.toISOString(),
        date,
        relatedKeys: [relatedKey],
        mode
      })
    );
    await this.taskNoteIndex.reindexFile(this.toIndexableFile(file));
    await this.hubNoteIndex.reindexFile(this.toIndexableFile(file));
    this.refreshOpenViews();
    if (this.settings.taskNotes.openNoteAfterCreate) {
      new TaskNoteModal(this, file, "create").open();
    } else {
      new Notice(t("taskNoteCreated"));
    }
  }

  async deleteTaskNoteFile(file: TFile): Promise<void> {
    await this.app.fileManager.trashFile(file);
    this.taskNoteIndex.removeFile(file.path);
    this.hubNoteIndex.removeFile(file.path);
    this.refreshOpenViews();
  }

  private async uniqueTaskNotePath(path: string): Promise<string> {
    if (!this.app.vault.getFileByPath(path)) return path;
    const withoutExtension = path.replace(/\.md$/iu, "");
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${withoutExtension}-${index}.md`;
      if (!this.app.vault.getFileByPath(candidate)) return candidate;
    }
    return `${withoutExtension}-${Date.now()}.md`;
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) void this.reindexVaultFile(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) void this.reindexVaultFile(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.taskIndex.removeFile(file.path);
        this.taskNoteIndex.removeFile(file.path);
        this.datedNoteIndex.removeFile(file.path);
        this.hubNoteIndex.removeFile(file.path);
        this.cleanupTaskListManualOrderState();
        void this.persistTaskIndexStateIfNeeded().then(() => this.refreshOpenViews());
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.taskIndex.removeFile(oldPath);
        this.taskNoteIndex.removeFile(oldPath);
        this.datedNoteIndex.removeFile(oldPath);
        this.hubNoteIndex.removeFile(oldPath);
        this.cleanupTaskListManualOrderState();
        if (file instanceof TFile) void this.reindexVaultFile(file);
        else void this.persistTaskIndexStateIfNeeded().then(() => this.refreshOpenViews());
      })
    );
  }

  private async reindexVaultFile(file: TFile): Promise<void> {
    const indexableFile = this.toIndexableFile(file);
    await this.taskIndex.reindexFile(indexableFile);
    await this.taskNoteIndex.reindexFile(indexableFile);
    await this.datedNoteIndex.reindexFile(indexableFile);
    await this.hubNoteIndex.reindexFile(indexableFile);
    this.cleanupTaskListManualOrderState();
    await this.persistTaskIndexStateIfNeeded();
    this.refreshOpenViews();
  }

  private toIndexableFile(file: TFile) {
    return {
      path: file.path,
      extension: file.extension,
      stat: {
        ctime: file.stat.ctime,
        mtime: file.stat.mtime,
        size: file.stat.size
      }
    };
  }

  refreshOpenViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TASK_HUB_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof TaskHubView) {
        view.render({
          preserveTaskListScroll: true,
          preserveContentScroll: true,
          preserveCalendarAgendaScroll: true
        });
      }
    }
  }

  private async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TASK_HUB_VIEW_TYPE)[0];
    if (existing) {
      void this.app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");

    await leaf.setViewState({ type: TASK_HUB_VIEW_TYPE, active: true });
    void this.app.workspace.revealLeaf(leaf);
  }
}

class TaskNoteModal extends Modal {
  private fileChangeRef?: EventRef;
  private isClosed = false;
  private saved = false;
  private cancelled = false;
  private busy = false;
  private noteComposer: TaskHubNoteComposer | undefined;
  private noteBody = "";

  constructor(
    private readonly plugin: TaskHubPlugin,
    private readonly file: TFile,
    private readonly mode: "create" | "edit"
  ) {
    super(plugin.app);
  }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("task-hub-note-modal");
    this.titleEl.setText(createTranslator(this.plugin.settings.language)("notes"));
    this.contentEl.empty();

    const editorHost = this.contentEl.createDiv({ cls: "task-hub-note-modal-editor" });
    this.fileChangeRef = this.app.vault.on("modify", (changed) => {
      if (changed === this.file) void this.plugin.reindexTaskNoteFile(this.file);
    });
    this.noteBody = noteBodyFromContent(await this.app.vault.cachedRead(this.file));
    this.noteComposer = createTaskHubNoteComposer({
      parent: editorHost,
      value: this.noteBody,
      placeholder: createTranslator(this.plugin.settings.language)("notes"),
      tagSuggestions: () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()),
      onChange: (value) => {
        this.noteBody = value;
      },
      onSubmit: () => {
        void this.saveAndClose();
      }
    });
    this.renderActions();
    editorHost.win.setTimeout(() => this.noteComposer?.focus(), 0);
  }

  onClose(): void {
    void this.closeNoteModal();
  }

  private async closeNoteModal(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    const noteComposer = this.noteComposer;
    this.noteComposer = undefined;
    if (this.fileChangeRef) {
      this.app.vault.offref(this.fileChangeRef);
      this.fileChangeRef = undefined;
    }
    noteComposer?.destroy();
    if (this.cancelled && this.mode === "create") {
      await this.plugin.deleteTaskNoteFile(this.file);
    } else if (this.saved || this.mode === "edit") {
      await this.plugin.deleteTaskNoteIfEmpty(this.file);
    } else if (this.mode === "create") {
      await this.plugin.deleteTaskNoteFile(this.file);
    }
    this.plugin.refreshTaskHubViews();
    this.contentEl.empty();
  }

  private renderActions(): void {
    const t = createTranslator(this.plugin.settings.language);
    const actions = this.contentEl.createDiv({ cls: "task-hub-note-modal-actions" });
    new ButtonComponent(actions)
      .setButtonText(t("cancel"))
      .onClick(() => {
        if (this.busy) return;
        this.cancelled = true;
        this.close();
      });
    new ButtonComponent(actions)
      .setButtonText(t("taskNoteSave"))
      .setCta()
      .onClick(() => {
        void this.saveAndClose();
      });
  }

  private async saveAndClose(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const result = await this.plugin.saveTaskNoteBody(this.file, this.noteComposer?.getValue() ?? this.noteBody);
      if (!result.ok) {
        this.busy = false;
        new Notice(result.message);
        return;
      }
      this.saved = true;
      if (!result.deleted) {
        new Notice(createTranslator(this.plugin.settings.language)(this.mode === "create" ? "taskNoteCreated" : "taskNoteSaved"));
      }
      this.close();
    } catch (error) {
      this.busy = false;
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}

class DatedNoteEditModal extends Modal {
  private noteComposer: TaskHubNoteComposer | undefined;
  private body: string;
  private busy = false;

  constructor(
    private readonly plugin: TaskHubPlugin,
    private readonly file: TFile,
    initialBody: string
  ) {
    super(plugin.app);
    this.body = initialBody;
  }

  onOpen(): void {
    const t = createTranslator(this.plugin.settings.language);
    this.modalEl.addClass("task-hub-note-modal");
    this.titleEl.setText(t("edit"));
    this.contentEl.empty();

    const editorHost = this.contentEl.createDiv({ cls: "task-hub-note-modal-editor" });
    this.noteComposer = createTaskHubNoteComposer({
      parent: editorHost,
      value: this.body,
      placeholder: t("noteCreationPlaceholder"),
      extensions: createDatedNoteComposerExtensions(this.plugin.app),
      tagSuggestions: () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()),
      onChange: (value) => {
        this.body = value;
      },
      onSubmit: () => {
        void this.saveAndClose();
      }
    });

    const actions = this.contentEl.createDiv({ cls: "task-hub-note-modal-actions" });
    new ButtonComponent(actions)
      .setButtonText(t("cancel"))
      .onClick(() => {
        if (this.busy) return;
        this.close();
      });
    new ButtonComponent(actions)
      .setButtonText(t("save"))
      .setCta()
      .onClick(() => {
        void this.saveAndClose();
      });

    editorHost.win.setTimeout(() => this.noteComposer?.focus(), 0);
  }

  onClose(): void {
    this.noteComposer?.destroy();
    this.noteComposer = undefined;
    this.contentEl.empty();
  }

  private async saveAndClose(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const result = await this.plugin.saveDatedNoteBody(this.file, this.noteComposer?.getValue() ?? this.body);
      this.busy = false;
      if (!result.ok) {
        new Notice(result.message);
        return;
      }
      new Notice(createTranslator(this.plugin.settings.language)("datedNoteSaved"));
      this.close();
    } catch (error) {
      this.busy = false;
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}

function isImeComposingEnterEvent(event: KeyboardEvent): boolean {
  return event.isComposing;
}

const CHECKBOX_LINE_PREFIX = /^(\s*)([-*]\s+\[[ xX]\]\s*)/u;

export function checkboxContinuation(lineText: string): { type: "continue"; insert: string } | { type: "exit"; replacement: string } | undefined {
  const match = lineText.match(CHECKBOX_LINE_PREFIX);
  if (!match) return undefined;
  const remainder = lineText.slice(match[0].length);
  if (remainder.trim().length === 0) {
    return { type: "exit", replacement: match[1] };
  }
  return {
    type: "continue",
    insert: `\n${match[1]}${match[2].replace(/\[[ xX]\]/u, "[ ]")}`
  };
}

export function shouldStripEmptyCheckboxLine(lineText: string, cursorInLine: number): boolean {
  const match = lineText.match(CHECKBOX_LINE_PREFIX);
  if (!match) return false;
  const remainder = lineText.slice(match[0].length);
  if (remainder.trim().length > 0) return false;
  return cursorInLine <= match[0].length;
}

type EasyTypingRuleResult = {
  matchRange?: { from: number; to: number };
  newText?: string;
  cursor?: number;
};

type EasyTypingPluginLike = {
  ruleEngine?: {
    process?: (context: Record<string, unknown>) => EasyTypingRuleResult | null | undefined;
  };
  settings?: {
    debug?: boolean;
  };
};

function createDatedNoteComposerExtensions(app: unknown): Extension[] {
  return [
    createEasyTypingComposerExtension(app),
    EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (event.isComposing) return false;
        if (event.key === "Enter") return continueCheckboxLine(view, event);
        if (event.key === "Backspace") return deleteEmptyCheckboxLinePrefix(view, event);
        if (event.key === "Tab") return indentComposerLine(view, event.shiftKey, event);
        return false;
      }
    })
  ];
}

function easyTypingPluginFromApp(app: unknown): EasyTypingPluginLike | undefined {
  const plugins = (app as { plugins?: { getPlugin?: (id: string) => unknown; plugins?: Record<string, unknown> } } | undefined)?.plugins;
  const plugin = plugins?.getPlugin?.("easy-typing-obsidian") ?? plugins?.plugins?.["easy-typing-obsidian"];
  if (!plugin || typeof plugin !== "object") return undefined;
  return plugin as EasyTypingPluginLike;
}

function createEasyTypingComposerExtension(app: unknown): Extension {
  return EditorView.updateListener.of((update) => {
    applyEasyTypingComposerRule(app, update);
  });
}

function applyEasyTypingComposerRule(app: unknown, update: ViewUpdate): boolean {
  if (!update.docChanged || update.view.composing) return false;
  if (update.transactions.some((transaction) =>
    transaction.isUserEvent("EasyTyping.change") ||
    transaction.isUserEvent("undo") ||
    transaction.isUserEvent("redo")
  )) {
    return false;
  }

  const easyTyping = easyTypingPluginFromApp(app);
  const ruleEngine = easyTyping?.ruleEngine;
  const process = ruleEngine?.process;
  if (typeof process !== "function") return false;
  const debug = easyTyping?.settings?.debug;

  const value = update.state.doc.toString();
  const selection = update.state.selection.main;
  if (selection.from !== selection.to) return false;
  const changeType = update.transactions.find((transaction) => transaction.annotation(Transaction.userEvent))?.annotation(Transaction.userEvent) ?? "input.type";
  const result = process.call(ruleEngine, {
    kind: "input",
    docText: value,
    selection: { from: selection.from, to: selection.to },
    inserted: "",
    changeType,
    scopeHint: "all",
    scopeLanguage: undefined,
    debug
  });
  if (!isEasyTypingRuleResult(result, value.length)) return false;

  const nextLength = value.length - (result.matchRange.to - result.matchRange.from) + result.newText.length;
  const cursor = clampNumber(result.cursor ?? result.matchRange.from + result.newText.length, 0, nextLength);
  update.view.dispatch({
    changes: { from: result.matchRange.from, to: result.matchRange.to, insert: result.newText },
    selection: { anchor: cursor },
    userEvent: "EasyTyping.change"
  });
  return true;
}

function isEasyTypingRuleResult(result: EasyTypingRuleResult | null | undefined, docLength: number): result is Required<Pick<EasyTypingRuleResult, "matchRange" | "newText">> & EasyTypingRuleResult {
  if (!result || typeof result.newText !== "string" || !result.matchRange) return false;
  const { from, to } = result.matchRange;
  return Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from && to <= docLength;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function continueCheckboxLine(view: EditorView, event: KeyboardEvent): boolean {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return false;
  const line = view.state.doc.lineAt(selection.from);
  const next = checkboxContinuation(line.text);
  if (!next) return false;

  event.preventDefault();
  if (next.type === "exit") {
    const anchor = line.from + next.replacement.length;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: next.replacement },
      selection: { anchor },
      userEvent: "input.type"
    });
    return true;
  }
  const position = selection.from + next.insert.length;
  view.dispatch({
    changes: { from: selection.from, insert: next.insert },
    selection: { anchor: position },
    userEvent: "input.type"
  });
  return true;
}

function deleteEmptyCheckboxLinePrefix(view: EditorView, event: KeyboardEvent): boolean {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return false;
  const line = view.state.doc.lineAt(selection.from);
  const cursorInLine = selection.from - line.from;
  if (!shouldStripEmptyCheckboxLine(line.text, cursorInLine)) return false;
  const match = line.text.match(CHECKBOX_LINE_PREFIX);
  if (!match) return false;

  event.preventDefault();
  const replacement = match[1];
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: replacement },
    selection: { anchor: line.from + replacement.length },
    userEvent: "delete.backward"
  });
  return true;
}

function indentComposerLine(view: EditorView, outdent: boolean, event: KeyboardEvent): boolean {
  event.preventDefault();
  const selection = view.state.selection.main;
  const line = view.state.doc.lineAt(selection.from);
  if (!outdent) {
    view.dispatch({
      changes: { from: line.from, insert: "  " },
      selection: { anchor: selection.anchor + 2, head: selection.head + 2 },
      userEvent: "input.indent"
    });
    return true;
  }

  const linePrefix = view.state.sliceDoc(line.from, Math.min(line.from + 2, line.to));
  const removable = linePrefix.startsWith("  ") ? 2 : linePrefix.startsWith("\t") ? 1 : 0;
  if (removable === 0) return true;
  view.dispatch({
    changes: { from: line.from, to: line.from + removable, insert: "" },
    selection: {
      anchor: Math.max(line.from, selection.anchor - removable),
      head: Math.max(line.from, selection.head - removable)
    },
    userEvent: "delete.dedent"
  });
  return true;
}

class CreateTaskModal extends Modal {
  private taskText = "";
  private notes = "";
  private alertEnabled = false;
  private alertMinutesBefore: ReminderAlertMinutes = 0;
  private recurrence: string | null = null;
  private eventRecurrenceStart = "";
  private eventRecurrenceUntil = "";
  private eventRecurrenceStartTouched = false;
  private detailsExpanded = false;
  private calendarTarget: CalendarDropTarget;
  private creationKind: CreateItemKind;
  private target: CalendarCreationTarget;
  private eventDurationMinutes: number;
  private noteComposer: TaskHubNoteComposer | undefined;

  constructor(
    private readonly plugin: TaskHubPlugin,
    calendarTarget: CalendarDropTarget,
    private readonly options: CreateTaskOptions = {}
  ) {
    super(plugin.app);
    this.calendarTarget = calendarTarget;
    this.creationKind = this.initialCreationKind();
    this.target = this.defaultTargetForKind(this.creationKind === "note" ? "task" : this.creationKind);
    const targetParts = calendarDropTargetParts(calendarTarget);
    this.eventDurationMinutes = validCalendarEventDuration(targetParts.durationMinutes ?? 60);
    this.eventRecurrenceStart = targetParts.dateKey;
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const t = createTranslator(this.plugin.settings.language);
    this.renderTitle(t);
    this.modalEl.addClass("task-hub-create-modal");
    this.noteComposer?.destroy();
    this.noteComposer = undefined;
    this.contentEl.empty();

    let submitButton: ButtonComponent | undefined;
    const submit = async () => {
      const text = this.taskText.trim();
      if (!text) return;
      submitButton?.setDisabled(true);
      try {
        if (this.creationKind === "note") {
          const note = await this.plugin.createDatedNote(toLocalDateKey(new Date()), text);
          if (note) this.options.onDatedNoteCreated?.(note);
          this.close();
          return;
        }
        await this.plugin.createTaskForDate(
          this.calendarTarget,
          text,
          this.target,
          this.notes,
          this.creationKind === "task" && this.target.type === "apple-reminders" && this.alertEnabled
            ? this.alertMinutesBefore
            : undefined,
          this.recurrence,
          this.creationKind === "event" ? this.eventRecurrenceUntil : undefined,
          this.creationKind === "event" ? this.eventRecurrenceStart : undefined,
          this.options
        );
        this.close();
      } catch (error) {
        submitButton?.setDisabled(false);
        new Notice(error instanceof Error ? error.message : String(error));
      }
    };

    new Setting(this.contentEl)
      .setName(t("calendarCreationKind"))
      .addDropdown((dropdown) => {
        populateCreationKindDropdown(dropdown.selectEl, t);
        if (this.canCreateDatedNote()) dropdown.addOption("note", t("notes"));
        dropdown.setValue(this.creationKind).onChange((value) => {
          this.creationKind = this.parseCreateItemKind(value);
          if (this.creationKind !== "note") {
            this.target = this.defaultTargetForKind(this.creationKind);
          }
          this.render();
        });
      });

    if (this.creationKind === "note") {
      const bodyField = this.contentEl.createDiv({ cls: "task-hub-create-note-body-field" });
      this.noteComposer = createTaskHubNoteComposer({
        parent: bodyField,
        value: this.taskText,
        placeholder: t("noteCreationPlaceholder"),
        className: "task-hub-create-note-body-input",
        extensions: createDatedNoteComposerExtensions(this.plugin.app),
        tagSuggestions: () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()),
        onChange: (value) => {
          this.taskText = value;
        },
        onSubmit: () => {
          void submit();
        }
      });
      bodyField.win.setTimeout(() => this.noteComposer?.focus(), 0);
    } else {
      const bodySetting = new Setting(this.contentEl).setName(t("taskCreationBody"));
      bodySetting.addText((text) => {
        text.setPlaceholder(this.creationKind === "event" ? t("eventCreationPlaceholder") : t("taskCreationPlaceholder")).setValue(this.taskText).onChange((value) => {
          this.taskText = value;
        });
        bindTaskHubTagInputSuggest(this.plugin.app, text.inputEl, () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()));
        text.inputEl.addEventListener("keydown", (event) => {
          if (isImeComposingEnterEvent(event)) return;
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        });
        text.inputEl.win.setTimeout(() => text.inputEl.focus(), 0);
      });
    }

    if (this.creationKind === "event") {
      const parts = durationInputParts(this.eventDurationMinutes);
      let days = parts.days;
      let hours = parts.hours;
      let minutes = parts.minutes;
      const updateDuration = () => {
        this.eventDurationMinutes = durationFromInputParts(days, hours, minutes);
        this.updateEventDurationTarget();
      };
      const durationSetting = new Setting(this.contentEl)
        .setName(t("eventCreationDuration"))
        .setDesc(t("eventCreationDurationDesc"));
      durationSetting.addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.step = "1";
        text.setPlaceholder(t("eventCreationDurationDays")).setValue(days).onChange((value) => {
          days = value;
          updateDuration();
        });
      });
      durationSetting.controlEl.createSpan({ cls: "task-hub-duration-unit", text: t("eventCreationDurationDays") });
      durationSetting.addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "23";
        text.inputEl.step = "1";
        text.setPlaceholder(t("eventCreationDurationHours")).setValue(hours).onChange((value) => {
          hours = value;
          updateDuration();
        });
      });
      durationSetting.controlEl.createSpan({ cls: "task-hub-duration-unit", text: t("eventCreationDurationHours") });
      durationSetting.addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "59";
        text.inputEl.step = "1";
        text.setPlaceholder(t("eventCreationDurationMinutes")).setValue(minutes).onChange((value) => {
          minutes = value;
          updateDuration();
        });
      });
      durationSetting.controlEl.createSpan({ cls: "task-hub-duration-unit", text: t("eventCreationDurationMinutes") });
    }

    const timeInput = this.creationKind === "note" ? undefined : this.renderScheduleControls(t);

    if (this.creationKind !== "note") {
      new Setting(this.contentEl)
        .setName(t("taskCreationTarget"))
        .setDesc(`${this.creationKind === "event" ? t("eventCreationDefaultTarget") : t("taskCreationDefaultTarget")}: ${creationTargetLabel(this.defaultTargetForKind(this.creationKind), this.plugin, t)}`)
        .addDropdown((dropdown) => {
          if (this.creationKind === "event") {
            populateEventCreationTargetDropdown(dropdown.selectEl, this.plugin, t);
          } else {
            populateTaskCreationTargetDropdown(dropdown.selectEl, this.plugin, t);
          }
          dropdown.setValue(serializeCreationTarget(this.target)).onChange((value) => {
            this.target = parseCreationTarget(value, this.creationKind as CalendarCreationKind);
            this.render();
          });
        });
    }

    if (this.creationKind !== "note") {
      new Setting(this.contentEl)
        .setName(t("editDetails"))
        .addToggle((toggle) => {
          toggle.setValue(this.detailsExpanded).onChange((value) => {
            this.detailsExpanded = value;
            this.render();
          });
        });
    }

    if (this.detailsExpanded && this.creationKind !== "note") {
      new Setting(this.contentEl)
        .setName(t("recurrence"))
        .addDropdown((dropdown) => {
          populateRecurrenceSelect(dropdown.selectEl, this.recurrence ?? undefined, t);
          dropdown.setValue(this.recurrence ?? "").onChange((value) => {
            this.recurrence = value || null;
          });
        });

      if (this.creationKind === "event") {
        new Setting(this.contentEl)
          .setName(t("recurrenceStartDate"))
          .addText((text) => {
            text.inputEl.type = "date";
            text.setValue(this.eventRecurrenceStart).onChange((value) => {
              this.eventRecurrenceStart = value;
              this.eventRecurrenceStartTouched = true;
            });
          });

        new Setting(this.contentEl)
          .setName(t("recurrenceEndDate"))
          .addText((text) => {
            text.inputEl.type = "date";
            text.setValue(this.eventRecurrenceUntil).onChange((value) => {
              this.eventRecurrenceUntil = value;
            });
          });
      }

      if (timeInput) this.renderAlertControls(t, timeInput);
    }

    if (this.detailsExpanded && (this.target.type === "apple-reminders" || this.target.type === "apple-calendar" || this.target.type === "dida")) {
      const notesSetting = new Setting(this.contentEl)
        .setName(t("notes"))
        .addTextArea((text) => {
          text.setValue(this.notes).onChange((value) => {
            this.notes = value;
          });
        });
      notesSetting.settingEl.addClass("task-hub-create-textarea-setting");
    }

    const actionSetting = new Setting(this.contentEl)
      .addButton((button) => {
        submitButton = button;
        button.setButtonText(this.creationKind === "note" ? t("save") : t("add")).setCta().onClick(() => {
          void submit();
        });
      })
      .addButton((button) => {
        button.setButtonText(t("cancel")).onClick(() => this.close());
      });
    actionSetting.settingEl.addClass("task-hub-create-action-setting");
  }

  onClose(): void {
    this.noteComposer?.destroy();
    this.noteComposer = undefined;
    this.contentEl.empty();
  }

  private renderTitle(t: ReturnType<typeof createTranslator>): void {
    this.titleEl.empty();
    this.titleEl.addClass("task-hub-create-modal-title");
    this.titleEl.createSpan({
      text: this.creationKind === "event"
        ? t("eventCreationTitle")
        : this.creationKind === "note"
          ? t("noteCreationTitle")
          : t("taskCreationTitle")
    });
  }

  private renderScheduleControls(t: ReturnType<typeof createTranslator>): HTMLInputElement | undefined {
    const schedule = new Setting(this.contentEl).setName(t("taskCreationTime"));
    schedule.settingEl.addClass("task-hub-create-schedule-setting");
    const datePicker = schedule.controlEl.createDiv({ cls: "task-hub-create-picker task-hub-create-date-picker" });
    const dateInput = datePicker.createEl("input", {
      cls: "task-hub-create-date-input",
      type: "date",
      value: calendarDropTargetParts(this.calendarTarget).dateKey
    });
    dateInput.setAttr("aria-label", t("date"));
    dateInput.addEventListener("change", () => {
      if (!dateInput.value) return;
      this.calendarTarget = withCalendarDropTargetDate(this.calendarTarget, dateInput.value);
      if (this.creationKind === "event" && !this.eventRecurrenceStartTouched) {
        this.eventRecurrenceStart = dateInput.value;
      }
    });
    dateInput.addEventListener("click", () => {
      try {
        dateInput.showPicker?.();
      } catch {
        dateInput.focus();
      }
    });
    const timePicker = schedule.controlEl.createDiv({ cls: "task-hub-create-picker task-hub-create-time-picker" });
    const timeInput = timePicker.createEl("input", {
      cls: "task-hub-create-time-input",
      type: "time",
      value: timeInputValue(calendarDropTargetParts(this.calendarTarget).startMinutes)
    });
    timeInput.step = "300";
    timeInput.addEventListener("click", () => {
      try {
        timeInput.showPicker?.();
      } catch {
        timeInput.focus();
      }
    });

    timeInput.addEventListener("change", () => {
      this.updateStartTimeFromInput(timeInput.value);
    });
    timeInput.addEventListener("input", () => {
      this.updateStartTimeFromInput(timeInput.value);
    });
    return timeInput;
  }

  private renderAlertControls(t: ReturnType<typeof createTranslator>, timeInput: HTMLInputElement): void {
    const alertSetting = new Setting(this.contentEl).setName(t("reminderAlert"));
    alertSetting.settingEl.addClass("task-hub-create-alert-setting");
    const alertLabel = alertSetting.controlEl.createEl("label", { cls: "task-hub-reminder-alert-switch task-hub-create-alert-switch" });
    const alertToggle = alertLabel.createEl("input", { cls: "task-hub-reminder-alert-toggle", type: "checkbox" });
    const alertSelect = alertSetting.controlEl.createEl("select", { cls: "task-hub-reminder-alert-select" });
    populateReminderAlertSelect(alertSelect, t);
    alertSelect.value = String(this.alertMinutesBefore);
    alertToggle.checked = this.alertEnabled;

    const updateAlertState = () => {
      const canAlert = this.creationKind === "task" && this.target.type === "apple-reminders";
      alertToggle.disabled = !canAlert;
      if (!canAlert) this.alertEnabled = false;
      alertToggle.checked = this.alertEnabled;
      alertSelect.disabled = !canAlert || !this.alertEnabled;
    };
    alertToggle.addEventListener("change", () => {
      if (alertToggle.checked && !timeInput.value) {
        timeInput.value = "09:00";
        this.updateStartTimeFromInput(timeInput.value);
      }
      this.alertEnabled = alertToggle.checked;
      updateAlertState();
    });
    alertSelect.addEventListener("change", () => {
      this.alertMinutesBefore = normalizeReminderAlertMinutes(Number(alertSelect.value)) ?? 0;
    });
    updateAlertState();
  }

  private updateStartTimeFromInput(value: string): void {
    const startMinutes = parseTimeInputValue(value);
    const current = calendarDropTargetParts(this.calendarTarget);
    this.calendarTarget =
      startMinutes === undefined
        ? this.creationKind === "event"
          ? {
              dateKey: current.dateKey,
              durationMinutes: this.eventDurationMinutes
            }
          : current.dateKey
        : {
            dateKey: current.dateKey,
            startMinutes,
            durationMinutes:
              this.creationKind === "event"
                ? this.eventDurationMinutes
                : undefined
          };
  }

  private defaultTargetForKind(kind: CalendarCreationKind): CalendarCreationTarget {
    return kind === "event"
      ? this.plugin.settings.calendarEventCreationDefaultTarget
      : this.plugin.settings.calendarTaskCreationDefaultTarget;
  }

  private canCreateDatedNote(): boolean {
    return this.options.allowDatedNote === true && this.plugin.notesViewEnabled();
  }

  private initialCreationKind(): CreateItemKind {
    if (this.options.initialKind === "note") {
      return this.canCreateDatedNote() ? "note" : this.plugin.settings.calendarCreationDefaultKind;
    }
    return this.options.initialKind ?? this.plugin.settings.calendarCreationDefaultKind;
  }

  private parseCreateItemKind(value: string): CreateItemKind {
    if (value === "note" && this.canCreateDatedNote()) return "note";
    return parseCreationKind(value);
  }

  private updateEventDurationTarget(): void {
    const current = calendarDropTargetParts(this.calendarTarget);
    this.calendarTarget =
      current.startMinutes === undefined
        ? {
            dateKey: current.dateKey,
            durationMinutes: this.eventDurationMinutes
          }
        : {
            dateKey: current.dateKey,
            startMinutes: current.startMinutes,
            durationMinutes: this.eventDurationMinutes
          };
  }
}

function hubNoteToTaskNote(note: HubNote): TaskNote {
  return {
    path: note.path,
    noteId: note.noteId,
    related: [...note.related],
    history: [...note.history],
    title: note.title,
    body: note.body,
    bodyStartLine: note.bodyStartLine,
    tags: [...note.tags],
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

function relatedTimelineDateForTask(task: TaskItem): string | undefined {
  return taskStartDateKey(task) ?? taskPlannedDateKey(task) ?? task.dueDate;
}

function preferredUnifiedNoteFolder(settings: TaskHubSettings, prefer: "dated" | "task"): string {
  const datedCustom =
    settings.datedNotes.folder.trim().length > 0 && settings.datedNotes.folder !== DEFAULT_SETTINGS.datedNotes.folder;
  const taskCustom =
    settings.taskNotes.notesFolder.trim().length > 0 && settings.taskNotes.notesFolder !== DEFAULT_SETTINGS.taskNotes.notesFolder;

  if (prefer === "task" && taskCustom) {
    return normalizeTaskNoteFolder(settings.taskNotes.notesFolder, DEFAULT_SETTINGS.taskNotes.notesFolder);
  }
  if (datedCustom) {
    return normalizeDatedNoteFolder(settings.datedNotes.folder, DEFAULT_SETTINGS.datedNotes.folder);
  }
  if (taskCustom) {
    return normalizeTaskNoteFolder(settings.taskNotes.notesFolder, DEFAULT_SETTINGS.taskNotes.notesFolder);
  }
  return normalizeDatedNoteFolder(settings.datedNotes.folder, DEFAULT_SETTINGS.datedNotes.folder);
}

class RiskySourceDeletionModal extends Modal {
  constructor(
    private readonly plugin: TaskHubPlugin,
    private readonly options: {
      title: string;
      message: string;
      onConfirm: () => void;
      onCancel: () => void;
    }
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText(this.options.title);
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: this.options.message });
    new Setting(this.contentEl)
      .addButton((button) => {
        button
          .setButtonText(createTranslator(this.plugin.settings.language)("cancel"))
          .onClick(() => {
            this.options.onCancel();
            this.close();
          });
      })
      .addButton((button) => {
        button
          .setButtonText(createTranslator(this.plugin.settings.language)("localAppleRemindersCreateRiskEnable"))
          .setCta()
          .onClick(() => {
            this.options.onConfirm();
            this.close();
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

type LocalAppleSettled<T> = { ok: true; value: T } | { ok: false; error: string };

async function settleLocalAppleSource<T>(read: () => Promise<T>): Promise<LocalAppleSettled<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function localAppleErrorStatus(message: string, attemptedAt: string): CalendarSourceStatus {
  return {
    state: "error",
    errorType: "local_error",
    message,
    lastAttemptAt: attemptedAt
  };
}

function localAppleStatusFromHelper(status: AppleHelperStatus, attemptedAt: string): LocalAppleSyncStatus {
  const reminders = localAppleAuthorizationStatus(status.remindersStatus?.authorization, attemptedAt);
  const calendar = localAppleAuthorizationStatus(status.calendarStatus?.authorization, attemptedAt);
  const failures = [reminders, calendar]
    .filter((source): source is Extract<CalendarSourceStatus, { state: "error" }> => source.state === "error")
    .map((source) => source.message);

  if (failures.length > 0) {
    return {
      state: "error",
      lastAttemptAt: attemptedAt,
      message: uniqueMessages(failures).join(" | "),
      reminders,
      calendar
    };
  }

  return {
    state: "ok",
    lastSyncedAt: attemptedAt,
    itemCount: 0,
    reminders,
    calendar
  };
}

function localAppleAuthorizationStatus(authorization: string | undefined, attemptedAt: string): CalendarSourceStatus {
  if (authorization === "fullAccess" || authorization === "authorized") {
    return { state: "ok", lastSyncedAt: attemptedAt, eventCount: 0 };
  }
  if (!authorization || authorization === "notDetermined") {
    return localAppleErrorStatus("Permission has not been requested.", attemptedAt);
  }
  if (authorization === "denied") {
    return localAppleErrorStatus("Permission denied in macOS Privacy & Security settings.", attemptedAt);
  }
  if (authorization === "restricted") {
    return localAppleErrorStatus("Permission is restricted on this Mac.", attemptedAt);
  }
  return localAppleErrorStatus(`Apple permission state is ${authorization}.`, attemptedAt);
}

function mergeAppleCalendarInfo(primary: AppleCalendarInfo[], fallback: AppleCalendarInfo[]): AppleCalendarInfo[] {
  const merged = new Map<string, AppleCalendarInfo>();
  for (const calendar of fallback) {
    merged.set(calendar.id, calendar);
  }
  for (const calendar of primary) {
    const existing = merged.get(calendar.id);
    merged.set(calendar.id, {
      id: calendar.id,
      name: calendar.name || existing?.name || calendar.id,
      color: calendar.color ?? existing?.color,
      writable: calendar.writable ?? existing?.writable
    });
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function uniqueMessages(messages: Array<string | undefined>): string[] {
  return Array.from(new Set(messages.filter((message): message is string => Boolean(message))));
}
