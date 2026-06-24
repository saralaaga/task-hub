import { ButtonComponent, Editor, EventRef, MarkdownView, Menu, Modal, Notice, Platform, Plugin, requestUrl, Setting, TFile, WorkspaceLeaf } from "obsidian";
import { PLUGIN_DISPLAY_NAME, TASK_HUB_VIEW_TYPE } from "./constants";
import { appleCalendarEventToReminderInput, appleReminderToCalendarEventInput } from "./calendar/appleConversion";
import { calendarDropTargetParts, withCalendarDropTargetDate, type CalendarDropTarget } from "./calendar/calendarDropTarget";
import { extractAppleReminderTitleTags, normalizeAppleReminderTags } from "./appleReminderTags";
import { fetchIcsSource } from "./calendar/icsClient";
import { DidaClient } from "./dida/didaClient";
import { DIDA_INBOX_PROJECT_NAME, didaProjectsFromRecords, didaSource, didaTaskToTaskItem, taskItemToDidaPayload } from "./dida/didaMapping";
import { extractDidaTitleTags } from "./dida/didaTags";
import { createTranslator } from "./i18n";
import { registerTaskHubIcon, TASK_HUB_ICON_ID } from "./icons";
import {
  canCreateAppleRemindersCapability,
  canCreateDidaTasksCapability,
  canDeleteAppleCalendarEventCapability,
  canDeleteAppleReminderCapability
} from "./integrationCapabilities";
import { parseTaskAtLine } from "./indexing/editorTask";
import { completeTaskInContent, deleteTaskInContent, rescheduleTaskInContent, updateTaskLineInContent, type CompletionResult } from "./indexing/taskActions";
import { TaskIndex } from "./indexing/taskIndex";
import { openExternalTaskSource } from "./externalSources";
import { appendTaskToContent, createTaskLine, normalizeTaskCreationFilePath } from "./taskCreation";
import { bindTaskHubTagInputSuggest, collectObsidianTags } from "./views/tagInputSuggest";
import { normalizeReminderAlertMinutes, populateReminderAlertSelect, type ReminderAlertMinutes } from "./reminderAlerts";
import { preferredTaskSendTarget, taskSendTargetOptions } from "./taskSendTargets";
import { snapDayStartMinutes } from "./timeGranularity";
import { recurrenceDatesBetween } from "./recurrence";
import {
  TaskNoteIndex,
  buildCalendarEventNoteKey,
  buildTaskNoteKey,
  createTaskNoteContent,
  normalizeTaskNoteFolder,
  replaceTaskNoteBody,
  taskNoteFileName,
  transferTaskNoteRelationship
} from "./taskNotes";
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
import type { AppleCalendarInfo, CalendarCreationKind, CalendarCreationTarget, CalendarEvent, CalendarItemEditDraft, CalendarSourceStatus, LocalAppleSyncStatus, TaskHubSettings, TaskItem, TaskSendTarget } from "./types";
import { TaskHubView } from "./views/TaskHubView";
import { populateRecurrenceSelect } from "./views/recurrenceControls";

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

function noteBodyStartLine(content: string): number {
  if (!content.startsWith("---")) return 0;
  const match = content.match(/^---\n[\s\S]*?\n---\n?/u);
  return match ? match[0].split("\n").length - 1 : 0;
}

export default class TaskHubPlugin extends Plugin {
  settings: TaskHubSettings = DEFAULT_SETTINGS;
  taskIndex: TaskIndex = this.createTaskIndex();
  taskNoteIndex: TaskNoteIndex = this.createTaskNoteIndex();
  localAppleTasks: TaskItem[] = [];
  localAppleEvents: CalendarEvent[] = [];
  localAppleStatus: LocalAppleSyncStatus = { state: "never" };
  didaTasks: TaskItem[] = [];
  private appleReminderWriteQueue: Promise<unknown> = Promise.resolve();

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
        void this.syncLocalApple();
        void this.syncDida();
      });
    } else {
      this.app.workspace.onLayoutReady(() => {
        void this.syncLocalApple();
        void this.syncDida();
      });
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<TaskHubSettings> | null;
    this.settings = normalizeTaskHubSettings(loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshOpenViews();
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
    await Promise.all([this.syncLocalApple({ silent: true }), this.syncDida({ silent: true })]);
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
      await this.reindexVaultFile(file);
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
      if (timedTarget.startMinutes === undefined && task.dueDate === timedTarget.dateKey && startMinutesFromTask(task) === undefined) {
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
            startMinutes: timedTarget.startMinutes,
            tags: this.settings.dida.tasksCreateTagsEnabled ? task.tags : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: task.recurrence
          })
        );
        await this.syncDida({ silent: true });
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

      if (timedTarget.startMinutes === undefined && task.dueDate === timedTarget.dateKey && startMinutesFromTask(task) === undefined) {
        new Notice(t("taskDateAlreadySet"));
        return { status: "already_in_state" };
      }

      try {
        const reminderId = task.externalId;
        await this.runAppleReminderWrite(() =>
          setAppleReminderDueDate(reminderId, timedTarget.dateKey, timedTarget.startMinutes)
        );
        await this.syncLocalApple({ silent: true });
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
      update.result = rescheduleTaskInContent(content, task, timedTarget.dateKey, {
        lineChangedConflict: t("lineChangedConflict"),
        lineMismatchConflict: t("lineMismatchConflict"),
        lineNoLongerOpen: t("lineNoLongerOpen"),
        lineOutsideFile: t("lineOutsideFile"),
        dateTokenMissing: t("taskDateTokenMissing")
      }, timedTarget.startMinutes);
      return update.result.status === "updated" ? update.result.content : content;
    });

    const updateResult = update.result;
    if (updateResult.status === "updated") {
      await this.reindexVaultFile(file);
      new Notice(t("taskDateUpdated"));
    } else if (updateResult.status === "already_in_state") {
      new Notice(t("taskDateAlreadySet"));
    } else {
      new Notice(updateResult.message);
    }

    this.refreshOpenViews();
    return updateResult;
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
            startMinutes: draft.startTime ? parseTimeInputValue(draft.startTime) : undefined,
            tags: this.settings.dida.tasksCreateTagsEnabled ? (draft.tags ?? task.tags) : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: recurrence === null ? "" : recurrence
          })
        );
        await this.syncDida({ silent: true });
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
        await this.runAppleReminderWrite(() => setAppleReminderDetails(input));
        await this.syncLocalApple({ silent: true });
        new Notice(t("taskUpdated"));
        this.refreshOpenViews();
        return { status: "updated", content: "", line: 0 };
      } catch (error) {
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
      await this.reindexVaultFile(file);
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
        dueDate: currentTask.dueDate,
        startMinutes: startMinutesFromTask(currentTask),
        listId: target.listId ?? this.settings.localApple.remindersDefaultListId,
        tags: this.settings.localApple.remindersCreateTagsEnabled ? normalizeAppleReminderTags(currentTask.tags) : [],
        ...(currentTask.recurrence ? { recurrence: currentTask.recurrence } : {})
      };
      const reminderId = await this.writeAppleReminderWithAccessRetry(() => createAppleReminder(input));
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
          date: currentTask.dueDate,
          startMinutes: startMinutesFromTask(currentTask),
          tags: this.settings.dida.tasksCreateTagsEnabled ? currentTask.tags : [],
          reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
          repeatFlag: currentTask.recurrence
        })
      );
      this.settings.didaTaskLinks = {
        ...this.settings.didaTaskLinks,
        [currentTask.id]: created.id
      };
      await this.saveSettings();

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
      await this.writeAppleReminderWithAccessRetry(() => setAppleReminderList(reminderId, listId));
      await this.syncLocalApple({ silent: true });
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
          date: task.dueDate ?? null,
          startMinutes: startMinutesFromTask(task),
          tags: this.settings.dida.tasksCreateTagsEnabled ? task.tags : [],
          reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
          repeatFlag: task.recurrence
        })
      );
      await this.syncDida({ silent: true });
      new Notice(t("taskUpdated"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  openCreateTaskModal(target: CalendarDropTarget): void {
    new CreateTaskModal(this, target).open();
  }

  async createTaskForDate(
    calendarTarget: CalendarDropTarget,
    text: string,
    target: CalendarCreationTarget = this.defaultCalendarCreationTarget(),
    notes?: string,
    alertMinutesBefore?: number | null,
    recurrence?: string | null,
    recurrenceUntil?: string,
    recurrenceStart?: string
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
        await this.syncLocalApple({ silent: true });
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
            startMinutes: timedTarget.startMinutes,
            tags: this.settings.dida.tasksCreateTagsEnabled ? didaText.tags : [],
            reminderOffsetMinutes: this.settings.dida.defaultReminderOffsetMinutes,
            repeatFlag: recurrence ?? undefined
          })
        );
        await this.syncDida({ silent: true });
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
    new Notice(t("taskCreated"));
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

  getTaskNotes(task: TaskItem) {
    return this.settings.taskNotes.enabled ? this.taskNoteIndex.getNotesForKey(buildTaskNoteKey(task)) : [];
  }

  getTaskNoteCount(task: TaskItem): number {
    return this.getTaskNotes(task).length;
  }

  getEventNotes(event: CalendarEvent) {
    return this.settings.taskNotes.enabled ? this.taskNoteIndex.getNotesForKey(buildCalendarEventNoteKey(event)) : [];
  }

  async openTaskNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
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

  async deleteTaskNote(path: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    const t = createTranslator(this.settings.language);
    if (!file) {
      new Notice(`${t("fileNotFound")}: ${path}`);
      return;
    }
    await this.app.fileManager.trashFile(file);
    this.taskNoteIndex.removeFile(path);
    this.refreshOpenViews();
    new Notice(t("taskNoteDeleted"));
  }

  async createTaskNoteForTask(task: TaskItem): Promise<void> {
    await this.createTaskNote(buildTaskNoteKey(task), task.text);
  }

  async createTaskNoteForEvent(event: CalendarEvent): Promise<void> {
    await this.createTaskNote(buildCalendarEventNoteKey(event), event.title);
  }

  async saveTaskNoteBody(file: TFile, body: string): Promise<{ ok: true; deleted?: boolean } | { ok: false; message: string }> {
    const t = createTranslator(this.settings.language);
    if (!body.trim()) {
      await this.deleteTaskNoteFile(file);
      return { ok: true, deleted: true };
    }
    const update = {
      result: { status: "conflict", message: t("taskUpdateFailed") } as ReturnType<typeof replaceTaskNoteBody>
    };
    await this.app.vault.process(file, (content) => {
      update.result = replaceTaskNoteBody(content, body);
      return update.result.status === "updated" ? update.result.content : content;
    });
    if (update.result.status !== "updated") {
      return { ok: false, message: update.result.message };
    }
    await this.taskNoteIndex.reindexFile(this.toIndexableFile(file));
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

  async syncDida(options: { silent?: boolean } = {}): Promise<void> {
    const t = createTranslator(this.settings.language);
    const enabled = this.settings.dida.enabled && this.settings.dida.tasksEnabled;
    if (!enabled) {
      this.didaTasks = [];
      this.settings.dida.syncStatus = { state: "never" };
      this.refreshOpenViews();
      return;
    }
    const attemptedAt = new Date().toISOString();
    if (!this.settings.dida.apiToken.trim()) {
      const message = t("didaApiTokenDesc");
      this.didaTasks = [];
      this.settings.dida.syncStatus = { state: "error", errorType: "local_error", message, lastAttemptAt: attemptedAt };
      if (!options.silent) new Notice(`${t("failedSync")} ${t("dida")}: ${message}`);
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

    if (remindersResult.ok) {
      this.localAppleTasks = remindersResult.value;
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
    }
    return { ok: true };
  }

  private async createTaskNote(relatedKey: string, title: string): Promise<void> {
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
    const folder = normalizeTaskNoteFolder(
      mode === "thino-multi-file" ? this.settings.taskNotes.thinoFolder : this.settings.taskNotes.notesFolder,
      mode === "thino-multi-file" ? DEFAULT_SETTINGS.taskNotes.thinoFolder : DEFAULT_SETTINGS.taskNotes.notesFolder
    );
    const path = await this.uniqueTaskNotePath(`${folder}/${taskNoteFileName(title, now, mode)}`);
    await this.ensureParentFolders(path);
    const noteId = `thn_${now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
    const file = await this.app.vault.create(
      path,
      createTaskNoteContent({
        noteId,
        relatedKey,
        title,
        createdAt: now.toISOString(),
        mode
      })
    );
    await this.taskNoteIndex.reindexFile(this.toIndexableFile(file));
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
        this.refreshOpenViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.taskIndex.removeFile(oldPath);
        this.taskNoteIndex.removeFile(oldPath);
        if (file instanceof TFile) void this.reindexVaultFile(file);
      })
    );
  }

  private async reindexVaultFile(file: TFile): Promise<void> {
    const indexableFile = this.toIndexableFile(file);
    await this.taskIndex.reindexFile(indexableFile);
    await this.taskNoteIndex.reindexFile(indexableFile);
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

  private refreshOpenViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TASK_HUB_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof TaskHubView) {
        void view.onOpen();
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
  private leaf?: WorkspaceLeaf;
  private fileChangeRef?: EventRef;
  private isClosed = false;
  private saved = false;
  private cancelled = false;
  private busy = false;

  constructor(
    private readonly plugin: TaskHubPlugin,
    private readonly file: TFile,
    private readonly mode: "create" | "edit"
  ) {
    super(plugin.app);
  }

  async onOpen(): Promise<void> {
    const showFrontmatter = this.plugin.settings.taskNotes.showFrontmatterInNoteModal;
    this.modalEl.addClass("task-hub-note-modal");
    this.modalEl.toggleClass("task-hub-note-modal-hide-frontmatter", !showFrontmatter);
    this.titleEl.setText(createTranslator(this.plugin.settings.language)("notes"));
    this.contentEl.empty();

    const editorHost = this.contentEl.createDiv({ cls: "task-hub-note-modal-editor" });
    const leaf = createDetachedWorkspaceLeaf(this.app);
    this.leaf = leaf;
    editorHost.appendChild(getWorkspaceLeafContainer(leaf));

    this.fileChangeRef = this.app.vault.on("modify", (changed) => {
      if (changed === this.file) void this.plugin.reindexTaskNoteFile(this.file);
    });

    await leaf.setViewState({
      type: "markdown",
      state: {
        file: this.file.path,
        mode: "source",
        source: false,
        properties: {
          visible: showFrontmatter
        }
      },
      active: true
    });

    this.syncFrontmatterVisibility(showFrontmatter);
    this.renderActions();
    this.focusBodyStart();
  }

  onClose(): void {
    void this.closeNoteModal();
  }

  private async closeNoteModal(): Promise<void> {
    this.isClosed = true;
    const leaf = this.leaf;
    this.leaf = undefined;
    if (this.fileChangeRef) {
      this.app.vault.offref(this.fileChangeRef);
      this.fileChangeRef = undefined;
    }
    if (leaf?.view instanceof MarkdownView && !this.cancelled) {
      await leaf.view.save();
    }
    leaf?.detach();
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
      if (this.leaf?.view instanceof MarkdownView) {
        await this.leaf.view.save();
      }
      this.saved = true;
      await this.plugin.reindexTaskNoteFile(this.file);
      new Notice(createTranslator(this.plugin.settings.language)(this.mode === "create" ? "taskNoteCreated" : "taskNoteSaved"));
      this.close();
    } catch (error) {
      this.busy = false;
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private focusBodyStart(): void {
    const view = this.leaf?.view;
    if (!(view instanceof MarkdownView) || this.isClosed) return;
    const bodyLine = noteBodyStartLine(view.getViewData());
    view.editor.setCursor({ line: bodyLine, ch: 0 });
    view.editor.focus();
    view.editor.scrollIntoView(
      {
        from: { line: bodyLine, ch: 0 },
        to: { line: bodyLine, ch: 0 }
      },
      true
    );
  }

  private syncFrontmatterVisibility(visible: boolean): void {
    const view = this.leaf?.view;
    if (!(view instanceof MarkdownView)) return;
    const currentEphemeralState =
      typeof view.getEphemeralState === "function" ? view.getEphemeralState() : {};
    view.setEphemeralState({
      ...currentEphemeralState,
      properties: {
        ...((currentEphemeralState.properties as Record<string, unknown> | undefined) ?? {}),
        visible
      }
    });
  }
}

function createDetachedWorkspaceLeaf(app: TaskHubPlugin["app"]): WorkspaceLeaf {
  type DetachedWorkspaceLeafConstructor = new (app: TaskHubPlugin["app"]) => WorkspaceLeaf;
  return new (WorkspaceLeaf as unknown as DetachedWorkspaceLeafConstructor)(app);
}

function getWorkspaceLeafContainer(leaf: WorkspaceLeaf): HTMLElement {
  return (leaf as WorkspaceLeaf & { containerEl: HTMLElement }).containerEl;
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
  private creationKind: CalendarCreationKind;
  private target: CalendarCreationTarget;
  private eventDurationMinutes: number;

  constructor(
    private readonly plugin: TaskHubPlugin,
    calendarTarget: CalendarDropTarget
  ) {
    super(plugin.app);
    this.calendarTarget = calendarTarget;
    this.creationKind = plugin.settings.calendarCreationDefaultKind;
    this.target = this.defaultTargetForKind(this.creationKind);
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
    this.contentEl.empty();

    let submitButton: ButtonComponent | undefined;
    const submit = async () => {
      const text = this.taskText.trim();
      if (!text) return;
      submitButton?.setDisabled(true);
      try {
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
          this.creationKind === "event" ? this.eventRecurrenceStart : undefined
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
        dropdown.setValue(this.creationKind).onChange((value) => {
          this.creationKind = parseCreationKind(value);
          this.target = this.defaultTargetForKind(this.creationKind);
          this.render();
        });
      });

    new Setting(this.contentEl)
      .setName(t("taskCreationBody"))
      .addText((text) => {
        text.setPlaceholder(this.creationKind === "event" ? t("eventCreationPlaceholder") : t("taskCreationPlaceholder")).setValue(this.taskText).onChange((value) => {
          this.taskText = value;
        });
        bindTaskHubTagInputSuggest(this.plugin.app, text.inputEl, () => collectObsidianTags(this.plugin.app, this.plugin.getTasks()));
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        });
        text.inputEl.win.setTimeout(() => text.inputEl.focus(), 0);
      });

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

    const timeInput = this.renderScheduleControls(t);

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
          this.target = parseCreationTarget(value, this.creationKind);
          this.render();
        });
      });

    new Setting(this.contentEl)
      .setName(t("editDetails"))
      .addToggle((toggle) => {
        toggle.setValue(this.detailsExpanded).onChange((value) => {
          this.detailsExpanded = value;
          this.render();
        });
      });

    if (this.detailsExpanded) {
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

      this.renderAlertControls(t, timeInput);
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

    new Setting(this.contentEl)
      .addButton((button) => {
        submitButton = button;
        button.setButtonText(t("add")).setCta().onClick(() => {
          void submit();
        });
      })
      .addButton((button) => {
        button.setButtonText(t("cancel")).onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderTitle(t: ReturnType<typeof createTranslator>): void {
    this.titleEl.empty();
    this.titleEl.addClass("task-hub-create-modal-title");
    this.titleEl.createSpan({ text: this.creationKind === "event" ? t("eventCreationTitle") : t("taskCreationTitle") });
  }

  private renderScheduleControls(t: ReturnType<typeof createTranslator>): HTMLInputElement {
    const schedule = new Setting(this.contentEl).setName(t("taskCreationTime"));
    schedule.settingEl.addClass("task-hub-create-schedule-setting");
    const datePicker = schedule.controlEl.createDiv({ cls: "task-hub-create-picker task-hub-create-date-picker" });
    const dateInput = datePicker.createEl("input", {
      cls: "task-hub-create-date-input",
      type: "date",
      value: calendarDropTargetParts(this.calendarTarget).dateKey
    }) as HTMLInputElement;
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
    }) as HTMLInputElement;
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
    const alertToggle = alertLabel.createEl("input", { cls: "task-hub-reminder-alert-toggle", type: "checkbox" }) as HTMLInputElement;
    const alertSelect = alertSetting.controlEl.createEl("select", { cls: "task-hub-reminder-alert-select" }) as HTMLSelectElement;
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
