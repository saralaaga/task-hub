import { ButtonComponent, Editor, MarkdownView, Menu, Modal, Notice, Platform, Plugin, requestUrl, Setting, TFile, WorkspaceLeaf } from "obsidian";
import { PLUGIN_DISPLAY_NAME, TASK_HUB_VIEW_TYPE } from "./constants";
import { fetchIcsSource } from "./calendar/icsClient";
import { createTranslator } from "./i18n";
import { registerTaskHubIcon, TASK_HUB_ICON_ID } from "./icons";
import { parseTaskAtLine } from "./indexing/editorTask";
import { completeTaskInContent, deleteTaskInContent, rescheduleTaskInContent, type CompletionResult } from "./indexing/taskActions";
import { TaskIndex } from "./indexing/taskIndex";
import { openExternalTaskSource } from "./externalSources";
import { appendTaskToContent, createTaskLine, normalizeTaskCreationFilePath } from "./taskCreation";
import {
  appleCalendarSource,
  appleCalendarsFromEvents,
  appleRemindersSource,
  configureLocalAppleHelperPath,
  createAppleReminder,
  createAppleCalendarEvent,
  getLocalAppleHelperStatus,
  installBundledAppleHelper,
  readAppleCalendarLists,
  readAppleCalendarEventsData,
  readAppleReminderLists,
  readAppleRemindersData,
  requestLocalAppleAccess,
  setAppleCalendarEventDate,
  setAppleReminderCompleted,
  setAppleReminderDueDate,
  setAppleReminderList,
  type AppleHelperStatus
} from "./localApple";
import {
  DEFAULT_SETTINGS,
  normalizeTaskHubSettings,
  parseTaskCreationTarget,
  populateTaskCreationTargetDropdown,
  serializeTaskCreationTarget,
  taskCreationTargetLabel,
  TaskHubSettingTab
} from "./settings";
import type { AppleCalendarInfo, CalendarEvent, CalendarSourceStatus, CalendarTaskCreationTarget, LocalAppleSyncStatus, TaskHubSettings, TaskItem } from "./types";
import type { CalendarDropTarget } from "./views/renderCalendarView";
import { TaskHubView } from "./views/TaskHubView";

type TimedCalendarTarget = {
  dateKey: string;
  startMinutes?: number;
  durationMinutes?: number;
};

function calendarDropTargetParts(target: CalendarDropTarget): TimedCalendarTarget {
  return typeof target === "string" ? { dateKey: target } : target;
}

export default class TaskHubPlugin extends Plugin {
  settings: TaskHubSettings = DEFAULT_SETTINGS;
  taskIndex: TaskIndex = this.createTaskIndex();
  localAppleTasks: TaskItem[] = [];
  localAppleEvents: CalendarEvent[] = [];
  localAppleStatus: LocalAppleSyncStatus = { state: "never" };

  isLocalAppleSupported(): boolean {
    return Platform.isDesktopApp && process.platform === "darwin";
  }

  notifyLocalAppleUnsupported(): void {
    new Notice(createTranslator(this.settings.language)("localAppleUnsupportedPlatform"));
  }

  canCreateAppleReminders(): boolean {
    return (
      this.isLocalAppleSupported() &&
      this.settings.localApple.enabled &&
      this.settings.localApple.remindersEnabled &&
      this.settings.localApple.remindersCreateEnabled
    );
  }

  canSendTasksToAppleCalendar(): boolean {
    return (
      this.isLocalAppleSupported() &&
      this.settings.localApple.enabled &&
      this.settings.localApple.calendarEnabled &&
      this.settings.localApple.calendarTaskSendEnabled
    );
  }

  getAppleReminderLists() {
    return this.settings.localApple.remindersLists;
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.configureLocalAppleHelper();
    this.taskIndex = this.createTaskIndex();
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
      });
    } else {
      this.app.workspace.onLayoutReady(() => {
        void this.syncLocalApple();
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
    await this.taskIndex.scanFiles(this.app.vault.getMarkdownFiles().map((file) => this.toIndexableFile(file)));
    await this.syncLocalApple({ silent: true });
    this.refreshOpenViews();
  }

  async completeTask(task: TaskItem): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);

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
        await setAppleReminderCompleted(task.externalId, !task.completed);
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

    if (timedTarget.startMinutes !== undefined && task.source === "vault") {
      return this.sendTaskToAppleCalendar(task, timedTarget);
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

      if (timedTarget.startMinutes === undefined && task.dueDate === timedTarget.dateKey) {
        new Notice(t("taskDateAlreadySet"));
        return { status: "already_in_state" };
      }

      try {
        await setAppleReminderDueDate(task.externalId, timedTarget.dateKey, timedTarget.startMinutes);
        if (timedTarget.startMinutes !== undefined) {
          await this.setAppleReminderDurationOverride(task.externalId, timedTarget.durationMinutes);
        }
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
      });
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

  private async setAppleReminderDurationOverride(reminderId: string, durationMinutes: number | undefined): Promise<void> {
    if (durationMinutes === undefined) return;
    const normalizedDuration = Math.max(15, Math.min(24 * 60, Math.round(durationMinutes)));
    this.settings.localApple.reminderDurationOverrides = {
      ...this.settings.localApple.reminderDurationOverrides,
      [reminderId]: normalizedDuration
    };
    await this.saveSettings();
  }

  async rescheduleCalendarEvent(event: CalendarEvent, target: CalendarDropTarget): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);
    const timedTarget = calendarDropTargetParts(target);

    if (
      event.sourceId !== "apple-calendar" ||
      !this.isLocalAppleSupported() ||
      !this.settings.localApple.enabled ||
      !this.settings.localApple.calendarEnabled ||
      !this.settings.localApple.calendarWritebackEnabled
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
        message: error instanceof Error ? error.message : String(error)
      };
      new Notice(result.message);
      return result;
    }
  }

  async sendTaskToAppleReminders(task: TaskItem): Promise<void> {
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
      const reminderId = await createAppleReminder({
        title: currentTask.text,
        notes: this.appleReminderNotes(currentTask),
        dueDate: currentTask.dueDate,
        listId: this.settings.localApple.remindersDefaultListId
      });
      this.settings.appleReminderLinks = {
        ...this.settings.appleReminderLinks,
        [currentTask.id]: reminderId
      };
      await this.saveSettings();

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
      await setAppleReminderList(task.externalId, listId);
      await this.syncLocalApple({ silent: true });
      new Notice(t("appleReminderListUpdated"));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  async sendTaskToAppleCalendar(task: TaskItem, timedTarget?: TimedCalendarTarget): Promise<CompletionResult> {
    const t = createTranslator(this.settings.language);

    if (!this.canSendTasksToAppleCalendar()) {
      const result: CompletionResult = { status: "conflict", message: t("appleCalendarCreateDisabled") };
      new Notice(result.message);
      return result;
    }

    if (task.source !== "vault") {
      const result: CompletionResult = { status: "conflict", message: t("appleCalendarCreateVaultOnly") };
      new Notice(result.message);
      return result;
    }

    if (!task.dueDate) {
      const result: CompletionResult = { status: "conflict", message: t("taskDateRequiredForCalendarSend") };
      new Notice(result.message);
      return result;
    }

    const file = this.app.vault.getFileByPath(task.filePath);
    if (!file) {
      const result: CompletionResult = { status: "conflict", message: `${t("fileNotFound")}: ${task.filePath}` };
      new Notice(result.message);
      return result;
    }

    const content = await this.app.vault.read(file);
    const currentTask = parseTaskAtLine({ filePath: task.filePath, content, line: task.line });
    if (!currentTask || currentTask.rawLine !== task.rawLine || !currentTask.dueDate) {
      const result: CompletionResult = { status: "conflict", message: t("lineChangedConflict") };
      new Notice(result.message);
      return result;
    }

    try {
      await createAppleCalendarEvent({
        title: currentTask.text,
        date: timedTarget?.dateKey ?? currentTask.dueDate,
        notes: this.appleCalendarEventNotes(currentTask),
        startMinutes: timedTarget?.startMinutes,
        durationMinutes: timedTarget?.durationMinutes
      });
    } catch (error) {
      const result: CompletionResult = {
        status: "conflict",
        message: error instanceof Error ? error.message : String(error)
      };
      new Notice(result.message);
      return result;
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
      await this.syncLocalApple({ silent: true });
      new Notice(t("appleCalendarCreatedAndTaskRemoved"));
    } else if (deletion.result.status === "conflict") {
      new Notice(deletion.result.message);
    }
    this.refreshOpenViews();
    return deletion.result;
  }

  openCreateTaskModal(dateKey: string): void {
    new CreateTaskModal(this, dateKey).open();
  }

  async createTaskForDate(dateKey: string, text: string, target: CalendarTaskCreationTarget = this.settings.calendarTaskCreationDefaultTarget): Promise<void> {
    const t = createTranslator(this.settings.language);
    const taskText = text.replace(/\s+/g, " ").trim();
    if (!taskText) return;

    if (target.type === "apple-reminders") {
      if (!this.canCreateAppleReminders()) {
        new Notice(t("appleReminderCreateDisabled"));
        return;
      }
      const reminderId = await createAppleReminder({
        title: taskText,
        dueDate: dateKey,
        listId: target.listId ?? this.settings.localApple.remindersDefaultListId
      });
      await this.syncLocalApple({ silent: true });
      new Notice(`${t("appleReminderCreated")}: ${reminderId}`);
      return;
    }

    const path = normalizeTaskCreationFilePath(this.settings.taskCreationFilePath);
    await this.ensureParentFolders(path);
    const taskLine = createTaskLine(taskText, dateKey);
    let file = this.app.vault.getFileByPath(path);
    if (!file) {
      file = await this.app.vault.create(path, appendTaskToContent("", taskLine));
    } else {
      await this.app.vault.process(file, (content) => appendTaskToContent(content, taskLine));
    }
    await this.reindexVaultFile(file);
    new Notice(t("taskCreated"));
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

  private appleCalendarEventNotes(task: TaskItem): string {
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
      const result = openExternalTaskSource(task);
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
      ...(this.isLocalAppleSupported() && this.settings.localApple.enabled && this.settings.localApple.remindersEnabled ? this.localAppleTasks : [])
    ];
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
    return sources;
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
        this.refreshOpenViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.taskIndex.removeFile(oldPath);
        if (file instanceof TFile) void this.reindexVaultFile(file);
      })
    );
  }

  private async reindexVaultFile(file: TFile): Promise<void> {
    await this.taskIndex.reindexFile(this.toIndexableFile(file));
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

class CreateTaskModal extends Modal {
  private taskText = "";
  private target: CalendarTaskCreationTarget;

  constructor(
    private readonly plugin: TaskHubPlugin,
    private readonly dateKey: string
  ) {
    super(plugin.app);
    this.target = plugin.settings.calendarTaskCreationDefaultTarget;
  }

  onOpen(): void {
    const t = createTranslator(this.plugin.settings.language);
    this.titleEl.setText(`${t("taskCreationTitle")} · ${this.dateKey}`);
    this.contentEl.empty();

    let submitButton: ButtonComponent | undefined;
    const submit = async () => {
      const text = this.taskText.trim();
      if (!text) return;
      submitButton?.setDisabled(true);
      try {
        await this.plugin.createTaskForDate(this.dateKey, text, this.target);
        this.close();
      } catch (error) {
        submitButton?.setDisabled(false);
        new Notice(error instanceof Error ? error.message : String(error));
      }
    };

    new Setting(this.contentEl)
      .setName(t("task"))
      .addText((text) => {
        text.setPlaceholder(t("taskCreationPlaceholder")).onChange((value) => {
          this.taskText = value;
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(this.contentEl)
      .setName(t("taskCreationTarget"))
      .setDesc(`${t("taskCreationDefaultTarget")}: ${taskCreationTargetLabel(this.plugin.settings.calendarTaskCreationDefaultTarget, this.plugin, t)}`)
      .addDropdown((dropdown) => {
        populateTaskCreationTargetDropdown(dropdown.selectEl, this.plugin, t);
        dropdown.setValue(serializeTaskCreationTarget(this.target)).onChange((value) => {
          this.target = parseTaskCreationTarget(value);
        });
      });

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
      color: calendar.color ?? existing?.color
    });
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function uniqueMessages(messages: Array<string | undefined>): string[] {
  return Array.from(new Set(messages.filter((message): message is string => Boolean(message))));
}
