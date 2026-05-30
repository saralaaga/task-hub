import { App, PluginSettingTab, Setting } from "obsidian";
import { createTranslator, type Translator } from "./i18n";
import type TaskHubPlugin from "./main";
import type { AppleCalendarInfo, CalendarCreationKind, CalendarCreationTarget, CalendarEventCreationTarget, CalendarSource, CalendarSourceStatus, CalendarTaskCreationTarget, LocalAppleSyncStatus, TaskHubSettings } from "./types";

export const TASK_HUB_SETTINGS_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: TaskHubSettings = {
  settingsSchemaVersion: TASK_HUB_SETTINGS_SCHEMA_VERSION,
  language: "en",
  defaultView: "tasks",
  weekStart: "monday",
  showCompletedByDefault: false,
  showLunarCalendar: false,
  indexOnStartup: true,
  calendarTaskCreationEnabled: true,
  calendarCreationDefaultKind: "task",
  calendarTaskCreationDefaultTarget: { type: "vault" },
  calendarEventCreationDefaultTarget: { type: "apple-calendar" },
  calendarTimeScale: "hour",
  calendarDayStartHour: 6,
  calendarDayEndHour: 22,
  taskCreationFilePath: "Task Hub.md",
  taskNotes: {
    enabled: false,
    notesFolder: "Task Hub Notes",
    defaultMode: "task-hub",
    thinoIntegrationEnabled: false,
    thinoFolder: "Thino",
    openNoteAfterCreate: true,
    showCountsInTaskList: true
  },
  taskViewFilters: {
    status: "open",
    tags: [],
    sourceQuery: "",
    textQuery: ""
  },
  ignoredPaths: ["Templates/", "Archive/"],
  tagViewOrder: [],
  calendarSources: [],
  appleReminderLinks: {},
  localApple: {
    enabled: false,
    remindersEnabled: false,
    remindersColor: "#f59e0b",
    reminderColorOverrides: {},
    remindersWritebackEnabled: false,
    remindersCreateEnabled: false,
    remindersCreateTagsEnabled: true,
    remindersDefaultListId: undefined,
    reminderDurationOverrides: {},
    remindersLists: [],
    calendarEnabled: false,
    calendarColor: "#6f94b8",
    calendarColorOverrides: {},
    calendars: [],
    calendarWritebackEnabled: false,
    calendarTaskSendEnabled: false,
    calendarReminderConversionEnabled: false,
    calendarDefaultTimedTaskDurationMinutes: 60,
    calendarLookbackDays: 30,
    calendarLookaheadDays: 90
  }
};

export function normalizeTaskHubSettings(loaded: Partial<TaskHubSettings> | null): TaskHubSettings {
  const loadedLocalApple = loaded?.localApple as Partial<TaskHubSettings["localApple"]> | undefined;
  const loadedSchemaVersion = loaded?.settingsSchemaVersion ?? 1;
  const localAppleEnabled =
    loadedLocalApple?.enabled ??
    Boolean(loadedLocalApple?.remindersEnabled || loadedLocalApple?.calendarEnabled || DEFAULT_SETTINGS.localApple.enabled);
  const remindersCreateTagsEnabled =
    loadedSchemaVersion < TASK_HUB_SETTINGS_SCHEMA_VERSION
      ? DEFAULT_SETTINGS.localApple.remindersCreateTagsEnabled
      : loadedLocalApple?.remindersCreateTagsEnabled ?? DEFAULT_SETTINGS.localApple.remindersCreateTagsEnabled;
  return {
    ...DEFAULT_SETTINGS,
    ...(loaded ?? {}),
    settingsSchemaVersion: TASK_HUB_SETTINGS_SCHEMA_VERSION,
    calendarTaskCreationEnabled: loaded?.calendarTaskCreationEnabled ?? DEFAULT_SETTINGS.calendarTaskCreationEnabled,
    calendarCreationDefaultKind: loaded?.calendarCreationDefaultKind ?? DEFAULT_SETTINGS.calendarCreationDefaultKind,
    calendarTimeScale: normalizeCalendarTimeScale(loaded?.calendarTimeScale),
    ...normalizeCalendarDayHours(loaded?.calendarDayStartHour, loaded?.calendarDayEndHour),
    showLunarCalendar: loaded?.showLunarCalendar ?? DEFAULT_SETTINGS.showLunarCalendar,
    calendarTaskCreationDefaultTarget:
      loaded?.calendarTaskCreationDefaultTarget ?? DEFAULT_SETTINGS.calendarTaskCreationDefaultTarget,
    calendarEventCreationDefaultTarget:
      loaded?.calendarEventCreationDefaultTarget ?? DEFAULT_SETTINGS.calendarEventCreationDefaultTarget,
    taskCreationFilePath: loaded?.taskCreationFilePath ?? DEFAULT_SETTINGS.taskCreationFilePath,
    taskNotes: normalizeTaskNotesSettings(loaded?.taskNotes),
    taskViewFilters: normalizeTaskViewFilters(loaded?.taskViewFilters, loaded?.showCompletedByDefault),
    localApple: {
      ...DEFAULT_SETTINGS.localApple,
      ...(loadedLocalApple ?? {}),
      enabled: localAppleEnabled,
      remindersColor: loadedLocalApple?.remindersColor ?? DEFAULT_SETTINGS.localApple.remindersColor,
      reminderColorOverrides:
        loadedLocalApple?.reminderColorOverrides ?? DEFAULT_SETTINGS.localApple.reminderColorOverrides,
      reminderDurationOverrides:
        loadedLocalApple?.reminderDurationOverrides ?? DEFAULT_SETTINGS.localApple.reminderDurationOverrides,
      remindersCreateTagsEnabled,
      remindersLists: loadedLocalApple?.remindersLists ?? DEFAULT_SETTINGS.localApple.remindersLists,
      calendarColor: loadedLocalApple?.calendarColor ?? DEFAULT_SETTINGS.localApple.calendarColor,
      calendarColorOverrides: loadedLocalApple?.calendarColorOverrides ?? DEFAULT_SETTINGS.localApple.calendarColorOverrides,
      calendars: loadedLocalApple?.calendars ?? DEFAULT_SETTINGS.localApple.calendars,
      calendarDefaultTimedTaskDurationMinutes:
        loadedLocalApple?.calendarDefaultTimedTaskDurationMinutes ??
        DEFAULT_SETTINGS.localApple.calendarDefaultTimedTaskDurationMinutes
    },
    appleReminderLinks: loaded?.appleReminderLinks ?? {}
  };
}

function normalizeCalendarTimeScale(value: unknown): TaskHubSettings["calendarTimeScale"] {
  return value === "fit" || value === "hour" || value === "half" || value === "quarter"
    ? value
    : DEFAULT_SETTINGS.calendarTimeScale;
}

function normalizeCalendarDayHours(start: unknown, end: unknown): Pick<TaskHubSettings, "calendarDayStartHour" | "calendarDayEndHour"> {
  const startHour = typeof start === "number" && Number.isInteger(start) && start >= 0 && start <= 23
    ? start
    : DEFAULT_SETTINGS.calendarDayStartHour;
  const endHour = typeof end === "number" && Number.isInteger(end) && end >= 1 && end <= 24
    ? end
    : DEFAULT_SETTINGS.calendarDayEndHour;
  if (endHour <= startHour) {
    return {
      calendarDayStartHour: DEFAULT_SETTINGS.calendarDayStartHour,
      calendarDayEndHour: DEFAULT_SETTINGS.calendarDayEndHour
    };
  }
  return {
    calendarDayStartHour: startHour,
    calendarDayEndHour: endHour
  };
}

function populateHourDropdown(selectEl: HTMLSelectElement, startHour: number, endHour: number): void {
  selectEl.empty();
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    selectEl.createEl("option", { value: String(hour), text: label });
  }
}

function normalizeTaskNotesSettings(loaded: Partial<TaskHubSettings["taskNotes"]> | undefined): TaskHubSettings["taskNotes"] {
  return {
    ...DEFAULT_SETTINGS.taskNotes,
    ...(loaded ?? {}),
    defaultMode: loaded?.defaultMode === "thino-multi-file" ? "thino-multi-file" : DEFAULT_SETTINGS.taskNotes.defaultMode,
    notesFolder: loaded?.notesFolder ?? DEFAULT_SETTINGS.taskNotes.notesFolder,
    thinoFolder: loaded?.thinoFolder ?? DEFAULT_SETTINGS.taskNotes.thinoFolder
  };
}

function normalizeTaskViewFilters(
  loaded: Partial<TaskHubSettings["taskViewFilters"]> | undefined,
  showCompletedByDefault: boolean | undefined
): TaskHubSettings["taskViewFilters"] {
  const dateBucket = normalizeStoredDateBucket(loaded?.dateBucket);
  return {
    ...DEFAULT_SETTINGS.taskViewFilters,
    ...(loaded ?? {}),
    status: loaded?.status ?? (showCompletedByDefault ? "all" : DEFAULT_SETTINGS.taskViewFilters.status),
    ...(dateBucket ? { dateBucket } : { dateBucket: undefined }),
    tags: Array.isArray(loaded?.tags) ? loaded.tags : DEFAULT_SETTINGS.taskViewFilters.tags,
    sourceQuery: loaded?.sourceQuery ?? DEFAULT_SETTINGS.taskViewFilters.sourceQuery,
    textQuery: loaded?.textQuery ?? DEFAULT_SETTINGS.taskViewFilters.textQuery,
    conditions: loaded?.conditions
      ? {
          operator: loaded.conditions.operator === "or" ? "or" : "and",
          tag: loaded.conditions.tag ?? "",
          dateBucket: normalizeStoredDateBucket(loaded.conditions.dateBucket) ?? "",
          text: loaded.conditions.text ?? ""
        }
      : undefined
  };
}

function normalizeStoredDateBucket(value: unknown): TaskHubSettings["taskViewFilters"]["dateBucket"] {
  if (value === "completed") return "otherCompleted";
  if (
    value === "overdue" ||
    value === "today" ||
    value === "tomorrow" ||
    value === "thisWeek" ||
    value === "future" ||
    value === "noDate" ||
    value === "otherCompleted"
  ) {
    return value;
  }
  return undefined;
}

const SOFT_LOCAL_APPLE_COLORS = ["#d97757", "#c7925b", "#9aa66f", "#6f9f8f", "#6f94b8", "#8f83b5"];
export const TASK_HUB_FEEDBACK_URL = "https://github.com/saralaaga/task-hub/issues/new";
type LocalAppleTab = "calendar" | "reminders";

export function openTaskHubFeedback(openUrl: (url: string) => void = (url) => window.open(url)): void {
  openUrl(TASK_HUB_FEEDBACK_URL);
}

export class TaskHubSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: TaskHubPlugin) {
    super(app, plugin);
  }

  display(options: { preserveScroll?: boolean } = {}): void {
    const { containerEl } = this;
    const scrollTop = options.preserveScroll ? containerEl.scrollTop : undefined;
    const t = createTranslator(this.plugin.settings.language);
    containerEl.empty();

    new Setting(containerEl).setName(t("settingsTitle")).setHeading();

    new Setting(containerEl)
      .setName(t("feedbackTitle"))
      .setDesc(t("feedbackDesc"))
      .addButton((button) => {
        button
          .setButtonText(t("feedbackButton"))
          .setCta()
          .onClick(() => openTaskHubFeedback());
      });

    const basicSettingsGrid = containerEl.createDiv({ cls: "task-hub-settings-grid" });

    new Setting(basicSettingsGrid)
      .setName(t("language"))
      .setDesc(t("languageDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("en", "English")
          .addOption("zh", "中文")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as TaskHubSettings["language"];
            await this.plugin.saveSettings();
            this.display({ preserveScroll: true });
          });
      });

    new Setting(basicSettingsGrid)
      .setName(t("defaultView"))
      .setDesc(t("defaultViewDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("tasks", t("tasks"))
          .addOption("calendar", t("calendar"))
          .addOption("tags", t("tags"))
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            this.plugin.settings.defaultView = value as TaskHubSettings["defaultView"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(basicSettingsGrid)
      .setName(t("weekStartsOn"))
      .setDesc(t("weekStartsOnDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("monday", t("monday"))
          .addOption("tuesday", t("tuesday"))
          .addOption("wednesday", t("wednesday"))
          .addOption("thursday", t("thursday"))
          .addOption("friday", t("friday"))
          .addOption("saturday", t("saturday"))
          .addOption("sunday", t("sunday"))
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as TaskHubSettings["weekStart"];
            await this.plugin.saveSettings();
          });
      });

    new Setting(basicSettingsGrid)
      .setName(t("calendarDayStartHour"))
      .setDesc(t("calendarDayStartHourDesc"))
      .addDropdown((dropdown) => {
        populateHourDropdown(dropdown.selectEl, 0, 23);
        dropdown.setValue(String(this.plugin.settings.calendarDayStartHour)).onChange(async (value) => {
          this.plugin.settings.calendarDayStartHour = Number(value);
          this.plugin.settings = normalizeTaskHubSettings(this.plugin.settings);
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(basicSettingsGrid)
      .setName(t("calendarDayEndHour"))
      .setDesc(t("calendarDayEndHourDesc"))
      .addDropdown((dropdown) => {
        populateHourDropdown(dropdown.selectEl, 1, 24);
        dropdown.setValue(String(this.plugin.settings.calendarDayEndHour)).onChange(async (value) => {
          this.plugin.settings.calendarDayEndHour = Number(value);
          this.plugin.settings = normalizeTaskHubSettings(this.plugin.settings);
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(basicSettingsGrid)
      .setName(t("showCompletedByDefault"))
      .setDesc(t("showCompletedByDefaultDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showCompletedByDefault).onChange(async (value) => {
          this.plugin.settings.showCompletedByDefault = value;
          await this.plugin.saveSettings();
        });
      });

    if (this.plugin.settings.language === "zh") {
      new Setting(basicSettingsGrid)
        .setName(t("showLunarCalendar"))
        .setDesc(t("showLunarCalendarDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.showLunarCalendar).onChange(async (value) => {
            this.plugin.settings.showLunarCalendar = value;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(basicSettingsGrid)
      .setName(t("indexOnStartup"))
      .setDesc(t("indexOnStartupDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.indexOnStartup).onChange(async (value) => {
          this.plugin.settings.indexOnStartup = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(basicSettingsGrid)
      .setName(t("calendarTaskCreation"))
      .setDesc(t("calendarTaskCreationDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.calendarTaskCreationEnabled).onChange(async (value) => {
          this.plugin.settings.calendarTaskCreationEnabled = value;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    if (this.plugin.settings.calendarTaskCreationEnabled) {
      new Setting(basicSettingsGrid)
        .setName(t("calendarCreationDefaultKind"))
        .setDesc(t("calendarCreationDefaultKindDesc"))
        .addDropdown((dropdown) => {
          populateCreationKindDropdown(dropdown.selectEl, t);
          dropdown.setValue(this.plugin.settings.calendarCreationDefaultKind).onChange(async (value) => {
            this.plugin.settings.calendarCreationDefaultKind = parseCreationKind(value);
            await this.plugin.saveSettings();
          });
        });

      new Setting(basicSettingsGrid)
        .setName(t("taskCreationDefaultTarget"))
        .setDesc(t("taskCreationDefaultTargetDesc"))
        .addDropdown((dropdown) => {
          populateTaskCreationTargetDropdown(dropdown.selectEl, this.plugin, t);
          dropdown.setValue(serializeTaskCreationTarget(this.plugin.settings.calendarTaskCreationDefaultTarget)).onChange(async (value) => {
            this.plugin.settings.calendarTaskCreationDefaultTarget = parseTaskCreationTarget(value);
            await this.plugin.saveSettings();
          });
        });

      new Setting(basicSettingsGrid)
        .setName(t("eventCreationDefaultTarget"))
        .setDesc(t("eventCreationDefaultTargetDesc"))
        .addDropdown((dropdown) => {
          populateEventCreationTargetDropdown(dropdown.selectEl, this.plugin, t);
          dropdown.setValue(serializeEventCreationTarget(this.plugin.settings.calendarEventCreationDefaultTarget)).onChange(async (value) => {
            this.plugin.settings.calendarEventCreationDefaultTarget = parseEventCreationTarget(value);
            await this.plugin.saveSettings();
          });
        });

      new Setting(basicSettingsGrid)
        .setName(t("taskCreationFile"))
        .setDesc(t("taskCreationFileDesc"))
        .addText((text) => {
          text.setPlaceholder(DEFAULT_SETTINGS.taskCreationFilePath).setValue(this.plugin.settings.taskCreationFilePath).onChange(async (value) => {
            this.plugin.settings.taskCreationFilePath = value;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl).setName(t("taskNotesSection")).setHeading();

    new Setting(containerEl)
      .setName(t("taskNotesEnable"))
      .setDesc(t("taskNotesEnableDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.taskNotes.enabled).onChange(async (value) => {
          this.plugin.settings.taskNotes.enabled = value;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    if (this.plugin.settings.taskNotes.enabled) {
      const taskNotesGrid = containerEl.createDiv({ cls: "task-hub-settings-grid" });
      new Setting(taskNotesGrid)
        .setName(t("taskNotesFolder"))
        .setDesc(t("taskNotesFolderDesc"))
        .addText((text) => {
          text.setPlaceholder(DEFAULT_SETTINGS.taskNotes.notesFolder).setValue(this.plugin.settings.taskNotes.notesFolder).onChange(async (value) => {
            this.plugin.settings.taskNotes.notesFolder = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(taskNotesGrid)
        .setName(t("taskNotesThino"))
        .setDesc(t("taskNotesThinoDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.taskNotes.thinoIntegrationEnabled).onChange(async (value) => {
            this.plugin.settings.taskNotes.thinoIntegrationEnabled = value;
            if (!value && this.plugin.settings.taskNotes.defaultMode === "thino-multi-file") {
              this.plugin.settings.taskNotes.defaultMode = "task-hub";
            }
            await this.plugin.saveSettings();
            this.display({ preserveScroll: true });
          });
        });

      new Setting(taskNotesGrid)
        .setName(t("taskNotesDefaultMode"))
        .setDesc(t("taskNotesDefaultModeDesc"))
        .addDropdown((dropdown) => {
          dropdown
            .addOption("task-hub", "Task Hub")
            .addOption("thino-multi-file", "Thino multi-file")
            .setValue(this.plugin.settings.taskNotes.defaultMode)
            .onChange(async (value) => {
              this.plugin.settings.taskNotes.defaultMode =
                value === "thino-multi-file" && this.plugin.settings.taskNotes.thinoIntegrationEnabled
                  ? "thino-multi-file"
                  : "task-hub";
              await this.plugin.saveSettings();
            });
        });

      if (this.plugin.settings.taskNotes.thinoIntegrationEnabled) {
        new Setting(taskNotesGrid)
          .setName(t("taskNotesThinoFolder"))
          .setDesc(t("taskNotesThinoFolderDesc"))
          .addText((text) => {
            text.setPlaceholder(DEFAULT_SETTINGS.taskNotes.thinoFolder).setValue(this.plugin.settings.taskNotes.thinoFolder).onChange(async (value) => {
              this.plugin.settings.taskNotes.thinoFolder = value;
              await this.plugin.saveSettings();
            });
          });
      }

      new Setting(taskNotesGrid)
        .setName(t("taskNotesOpenAfterCreate"))
        .setDesc(t("taskNotesOpenAfterCreateDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.taskNotes.openNoteAfterCreate).onChange(async (value) => {
            this.plugin.settings.taskNotes.openNoteAfterCreate = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(taskNotesGrid)
        .setName(t("taskNotesShowCounts"))
        .setDesc(t("taskNotesShowCountsDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.taskNotes.showCountsInTaskList).onChange(async (value) => {
            this.plugin.settings.taskNotes.showCountsInTaskList = value;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl)
      .setName(t("ignoredPaths"))
      .setDesc(t("ignoredPathsDesc"))
      .addTextArea((text) => {
        text.setValue(this.plugin.settings.ignoredPaths.join(", ")).onChange(async (value) => {
          this.plugin.settings.ignoredPaths = value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName(t("supportedTaskSyntax")).setDesc(t("supportedTaskSyntaxDesc")).setHeading();

    this.displayCalendarSources(containerEl);
    this.displayLocalApple(containerEl);
    if (scrollTop !== undefined) {
      containerEl.scrollTop = scrollTop;
    }
  }

  private displayLocalApple(containerEl: HTMLElement): void {
    const t = createTranslator(this.plugin.settings.language);
    new Setting(containerEl).setName(t("localApple")).setDesc(t("localAppleDesc")).setHeading();

    new Setting(containerEl)
      .setName(t("localApple"))
      .setDesc(this.plugin.settings.localApple.enabled ? createLocalAppleStatusFragment(undefined, this.plugin.localAppleStatus, t) : t("localAppleDisabledDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.enabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.enabled = value;
          if (!value) {
            this.plugin.settings.localApple.calendarEnabled = false;
            this.plugin.settings.localApple.calendarWritebackEnabled = false;
            this.plugin.settings.localApple.calendarTaskSendEnabled = false;
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
            this.plugin.settings.localApple.remindersEnabled = false;
            this.plugin.settings.localApple.remindersWritebackEnabled = false;
            this.plugin.settings.localApple.remindersCreateEnabled = false;
          }
          await this.plugin.saveSettings();
          await this.plugin.syncLocalApple();
          this.display({ preserveScroll: true });
        });
      })
      .addButton((button) => {
        button
          .setButtonText(t("localAppleCheckStatus"))
          .setDisabled(!this.plugin.settings.localApple.enabled)
          .onClick(async () => {
            await this.plugin.refreshLocalAppleStatus();
            this.display({ preserveScroll: true });
          });
      })
      .addButton((button) => {
        button
          .setButtonText(t("localAppleRequestAccess"))
          .setDisabled(
            !this.plugin.settings.localApple.enabled ||
              (!this.plugin.settings.localApple.remindersEnabled && !this.plugin.settings.localApple.calendarEnabled)
          )
          .onClick(async () => {
            await this.plugin.requestLocalApplePermissions();
            this.display({ preserveScroll: true });
          });
      });

    if (!this.plugin.settings.localApple.enabled) {
      return;
    }

    new Setting(containerEl)
      .setName(t("localAppleCalendar"))
      .setDesc(createLocalAppleStatusFragment(this.plugin.localAppleStatus.calendar, this.plugin.localAppleStatus, t, t("localAppleCalendarDesc")))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.calendarEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.calendarEnabled = value;
          if (!value) {
            this.plugin.settings.localApple.calendarWritebackEnabled = false;
            this.plugin.settings.localApple.calendarTaskSendEnabled = false;
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
          }
          await this.plugin.saveSettings();
          await this.plugin.syncLocalApple();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(containerEl)
      .setName(t("localAppleReminders"))
      .setDesc(
        this.plugin.settings.localApple.remindersEnabled
          ? createLocalAppleStatusFragment(this.plugin.localAppleStatus.reminders, this.plugin.localAppleStatus, t, t("localAppleRemindersDesc"))
          : t("localAppleRemindersDisabledDesc")
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.remindersEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.remindersEnabled = value;
          if (!value) {
            this.plugin.settings.localApple.remindersWritebackEnabled = false;
            this.plugin.settings.localApple.remindersCreateEnabled = false;
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
          }
          await this.plugin.saveSettings();
          await this.plugin.syncLocalApple();
          this.display({ preserveScroll: true });
        });
      });

    const tabs = this.enabledLocalAppleTabs();
    if (tabs.length === 0) {
      containerEl.createDiv({ cls: "task-hub-empty", text: t("localAppleNoEnabledTabs") });
      return;
    }

    const activeTab = this.activeLocalAppleTab(tabs);
    const tabList = containerEl.createDiv({ cls: "task-hub-settings-tab-list" });
    for (const tab of tabs) {
      const button = tabList.createEl("button", {
        cls: `task-hub-settings-tab ${tab === activeTab ? "is-active" : ""}`,
        text: tab === "calendar" ? t("localAppleCalendar") : t("localAppleReminders"),
        attr: { type: "button" }
      });
      button.addEventListener("click", () => {
        this.localAppleTab = tab;
        this.display({ preserveScroll: true });
      });
    }

    if (activeTab === "calendar") {
      this.displayAppleCalendarTab(containerEl, t);
    } else {
      this.displayAppleRemindersTab(containerEl, t);
    }
  }

  private localAppleTab: LocalAppleTab = "calendar";

  private enabledLocalAppleTabs(): LocalAppleTab[] {
    return [
      this.plugin.settings.localApple.calendarEnabled ? "calendar" : undefined,
      this.plugin.settings.localApple.remindersEnabled ? "reminders" : undefined
    ].filter((tab): tab is LocalAppleTab => Boolean(tab));
  }

  private activeLocalAppleTab(tabs: LocalAppleTab[]): LocalAppleTab {
    if (tabs.includes(this.localAppleTab)) return this.localAppleTab;
    this.localAppleTab = tabs[0];
    return this.localAppleTab;
  }

  private displayAppleCalendarTab(containerEl: HTMLElement, t: Translator): void {
    const panel = containerEl.createDiv({ cls: "task-hub-settings-tab-panel" });
    const calendars = mergeAppleCalendarsFromSettings(this.plugin.settings.localApple.calendars, this.plugin.localAppleEvents ?? []);

    if (calendars.length === 0) {
      this.displayLocalAppleColorSetting(
        panel,
        t,
        t("localAppleCalendarColor"),
        t("localAppleCalendarColorDesc"),
        this.plugin.settings.localApple.calendarColor,
        DEFAULT_SETTINGS.localApple.calendarColor,
        (color) => {
          this.plugin.settings.localApple.calendarColor = color;
        }
      );
    }
    this.displayAppleCalendarColorOverrides(panel, t, calendars);

    new Setting(panel)
      .setName(t("localAppleCalendarWriteback"))
      .setDesc(t("localAppleCalendarWritebackDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.calendarWritebackEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.calendarWritebackEnabled = value;
          if (!value) {
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
          }
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(panel)
      .setName(t("localAppleCalendarTaskSend"))
      .setDesc(t("localAppleCalendarTaskSendDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.calendarTaskSendEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          if (value && !(await this.plugin.confirmRiskySourceDeletionSetting())) {
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.calendarTaskSendEnabled = value;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    if (this.plugin.settings.localApple.remindersEnabled) {
      new Setting(panel)
        .setName(t("localAppleCalendarReminderConversion"))
        .setDesc(t("localAppleCalendarReminderConversionDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.localApple.calendarReminderConversionEnabled).onChange(async (value) => {
            if (value && !this.plugin.canConvertAppleCalendarAndReminders()) {
              this.plugin.notifyLocalAppleConversionDisabled();
              this.display({ preserveScroll: true });
              return;
            }
            if (value && !(await this.plugin.confirmRiskyAppleConversionSetting())) {
              this.display({ preserveScroll: true });
              return;
            }
            this.plugin.settings.localApple.calendarReminderConversionEnabled = value;
            await this.plugin.saveSettings();
            this.display({ preserveScroll: true });
          });
        });
    }

    new Setting(panel)
      .setName(t("localAppleCalendarDefaultTimedTaskDuration"))
      .setDesc(t("localAppleCalendarDefaultTimedTaskDurationDesc"))
      .addText((text) => {
        text.setValue(String(this.plugin.settings.localApple.calendarDefaultTimedTaskDurationMinutes)).onChange(async (value) => {
          const minutes = Number.parseInt(value, 10);
          if (Number.isFinite(minutes) && minutes >= 15 && minutes <= 1440) {
            this.plugin.settings.localApple.calendarDefaultTimedTaskDurationMinutes = minutes;
            await this.plugin.saveSettings();
          }
        });
      });

    new Setting(panel)
      .setName(t("localAppleLookback"))
      .addText((text) => {
        text.setValue(String(this.plugin.settings.localApple.calendarLookbackDays)).onChange(async (value) => {
          const days = Number.parseInt(value, 10);
          if (Number.isFinite(days) && days >= 0) {
            this.plugin.settings.localApple.calendarLookbackDays = days;
            await this.plugin.saveSettings();
            await this.plugin.syncLocalApple({ silent: true });
            this.display({ preserveScroll: true });
          }
        });
      });

    new Setting(panel)
      .setName(t("localAppleLookahead"))
      .addText((text) => {
        text.setValue(String(this.plugin.settings.localApple.calendarLookaheadDays)).onChange(async (value) => {
          const days = Number.parseInt(value, 10);
          if (Number.isFinite(days) && days >= 0) {
            this.plugin.settings.localApple.calendarLookaheadDays = days;
            await this.plugin.saveSettings();
            await this.plugin.syncLocalApple({ silent: true });
            this.display({ preserveScroll: true });
          }
        });
      });
  }

  private displayAppleCalendarColorOverrides(containerEl: HTMLElement, t: Translator, calendars: AppleCalendarInfo[]): void {
    if (calendars.length === 0) {
      containerEl.createDiv({ cls: "task-hub-empty", text: t("localAppleCalendarColorNoCalendars") });
      return;
    }

    new Setting(containerEl).setName(t("localAppleCalendarColors")).setDesc(t("localAppleCalendarColorsDesc")).setHeading();
    for (const calendar of calendars) {
      const value =
        this.plugin.settings.localApple.calendarColorOverrides[calendar.id] ??
        calendar.color ??
        this.plugin.settings.localApple.calendarColor;
      this.displayLocalAppleColorSetting(
        containerEl,
        t,
        calendar.name,
        `${t("localAppleCalendarSystemColor")}: ${calendar.color ?? t("notSynced")}`,
        value,
        calendar.color ?? this.plugin.settings.localApple.calendarColor,
        (color) => {
          this.plugin.settings.localApple.calendarColorOverrides = {
            ...this.plugin.settings.localApple.calendarColorOverrides,
            [calendar.id]: color
          };
        }
      );
    }
  }

  private displayAppleRemindersTab(containerEl: HTMLElement, t: Translator): void {
    const panel = containerEl.createDiv({ cls: "task-hub-settings-tab-panel" });

    this.displayLocalAppleColorSetting(
      panel,
      t,
      t("localAppleRemindersColor"),
      t("localAppleRemindersColorDesc"),
      this.plugin.settings.localApple.remindersColor,
      DEFAULT_SETTINGS.localApple.remindersColor,
      (color) => {
        this.plugin.settings.localApple.remindersColor = color;
      }
    );
    this.displayAppleReminderColorOverrides(panel, t);

    new Setting(panel)
      .setName(t("localAppleRemindersWriteback"))
      .setDesc(t("localAppleRemindersWritebackDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.remindersWritebackEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.remindersWritebackEnabled = value;
          if (!value) {
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
          }
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(panel)
      .setName(t("localAppleRemindersCreate"))
      .setDesc(t("localAppleRemindersCreateDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.localApple.remindersCreateEnabled).onChange(async (value) => {
          if (value && !this.plugin.isLocalAppleSupported()) {
            this.plugin.notifyLocalAppleUnsupported();
            this.display({ preserveScroll: true });
            return;
          }
          if (value && !(await this.plugin.confirmRiskySourceDeletionSetting())) {
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.localApple.remindersCreateEnabled = value;
          if (!value) {
            this.plugin.settings.localApple.calendarReminderConversionEnabled = false;
          }
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    if (this.plugin.settings.localApple.remindersCreateEnabled) {
      new Setting(panel)
        .setName(t("localAppleRemindersCreateTags"))
        .setDesc(t("localAppleRemindersCreateTagsDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.localApple.remindersCreateTagsEnabled).onChange(async (value) => {
            this.plugin.settings.localApple.remindersCreateTagsEnabled = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(panel)
        .setName(t("localAppleRemindersDefaultList"))
        .setDesc(t("localAppleRemindersDefaultListDesc"))
        .addDropdown((dropdown) => {
          populateAppleReminderListDropdown(dropdown.selectEl, this.plugin, t);
          dropdown.setValue(this.plugin.settings.localApple.remindersDefaultListId ?? "").onChange(async (value) => {
            this.plugin.settings.localApple.remindersDefaultListId = value || undefined;
            await this.plugin.saveSettings();
          });
        });
    }
  }

  private displayAppleReminderColorOverrides(containerEl: HTMLElement, t: Translator): void {
    const lists = this.plugin.getAppleReminderLists();
    if (lists.length === 0) {
      containerEl.createDiv({ cls: "task-hub-empty", text: t("localAppleReminderColorNoLists") });
      return;
    }

    new Setting(containerEl).setName(t("localAppleReminderListColors")).setDesc(t("localAppleReminderListColorsDesc")).setHeading();
    for (const list of lists) {
      const value =
        this.plugin.settings.localApple.reminderColorOverrides[list.id] ??
        this.plugin.settings.localApple.remindersColor;
      this.displayLocalAppleColorSetting(
        containerEl,
        t,
        list.name,
        `${t("appleReminderList")}: ${list.name}`,
        value,
        this.plugin.settings.localApple.remindersColor,
        (color) => {
          this.plugin.settings.localApple.reminderColorOverrides = {
            ...this.plugin.settings.localApple.reminderColorOverrides,
            [list.id]: color
          };
        }
      );
    }
  }

  private displayLocalAppleColorSetting(
    containerEl: HTMLElement,
    t: Translator,
    name: string,
    description: string,
    value: string,
    fallback: string,
    setColor: (color: string) => void
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addExtraButton((button) => {
        const icon = button.extraSettingsEl;
        const picker = icon.createEl("input", { cls: "task-hub-color-picker", type: "color" }) as HTMLInputElement;
        const setPreview = (color: string) => {
          icon.style.setProperty("--task-hub-color-preview", color);
          icon.setAttribute("aria-label", `${name}: ${color}`);
          picker.value = normalizeColor(color, fallback);
        };
        button.setIcon("circle").setTooltip(name);
        icon.addClass("task-hub-color-preview");
        setPreview(value);
        picker.addEventListener("input", async () => {
          setColor(normalizeColor(picker.value, fallback));
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      })
      .addText((text) => {
        const applyColor = async (nextValue: string) => {
          setColor(normalizeColor(nextValue, fallback));
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        };
        text.setPlaceholder(fallback).setValue(value).onChange(applyColor);
      })
      .then((setting) => {
        const palette = setting.controlEl.createDiv({ cls: "task-hub-color-swatches" });
        for (const color of SOFT_LOCAL_APPLE_COLORS) {
          const swatch = palette.createEl("button", {
            cls: `task-hub-color-swatch ${color === value ? "is-selected" : ""}`,
            attr: {
              "aria-label": `${name}: ${color}`,
              type: "button"
            }
          });
          swatch.style.setProperty("--task-hub-swatch-color", color);
          swatch.addEventListener("click", () => {
            setColor(color);
            void this.plugin.saveSettings().then(() => this.display({ preserveScroll: true }));
          });
        }
      });
  }

  private displayCalendarSources(containerEl: HTMLElement): void {
    const t = createTranslator(this.plugin.settings.language);
    new Setting(containerEl).setName(t("externalCalendars")).setHeading();

    for (const source of this.plugin.settings.calendarSources) {
      const statusText =
        source.status.state === "ok"
          ? `${t("synced")}, ${source.status.eventCount} ${t("events")}, ${source.status.lastSyncedAt}`
          : source.status.state === "error"
            ? `${errorTypeLabel(source.status.errorType, t)}: ${source.status.message}`
            : t("neverSynced");

      new Setting(containerEl)
        .setName(source.name)
        .setDesc(`${source.url} | ${statusText}`)
        .addToggle((toggle) => {
          toggle.setValue(source.enabled).onChange(async (value) => {
            source.enabled = value;
            await this.plugin.saveSettings();
            this.display({ preserveScroll: true });
          });
        })
        .addText((text) => {
          text.setPlaceholder("#3b82f6").setValue(source.color).onChange(async (value) => {
            source.color = value;
            await this.plugin.saveSettings();
          });
        })
        .addText((text) => {
          text.setPlaceholder("60").setValue(String(source.refreshIntervalMinutes)).onChange(async (value) => {
            const minutes = Number.parseInt(value, 10);
            if (Number.isFinite(minutes) && minutes > 0) {
              source.refreshIntervalMinutes = minutes;
              await this.plugin.saveSettings();
            }
          });
        })
        .addButton((button) => {
          button.setButtonText(t("sync")).onClick(async () => {
            await this.plugin.syncCalendarSource(source.id);
            this.display({ preserveScroll: true });
          });
        })
        .addButton((button) => {
          button.setButtonText(t("remove")).onClick(async () => {
            this.plugin.settings.calendarSources = this.plugin.settings.calendarSources.filter(
              (candidate) => candidate.id !== source.id
            );
            await this.plugin.saveSettings();
            this.display({ preserveScroll: true });
          });
        });
    }

    let name = "";
    let url = "";
    new Setting(containerEl)
      .setName(t("addIcsSource"))
      .setDesc(t("addIcsSourceDesc"))
      .addText((text) => {
        text.setPlaceholder(t("name")).onChange((value) => {
          name = value.trim();
        });
      })
      .addText((text) => {
        text.setPlaceholder("https://example.com/calendar.ics").onChange((value) => {
          url = value.trim();
        });
      })
      .addButton((button) => {
        button.setButtonText(t("add")).onClick(async () => {
          if (!name || !url) return;
          this.plugin.settings.calendarSources.push(createCalendarSource(name, url));
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });
  }
}

type CalendarErrorType = Extract<CalendarSourceStatus, { state: "error" }>["errorType"];

function createLocalAppleStatusFragment(
  sourceStatus: CalendarSourceStatus | undefined,
  fallback: LocalAppleSyncStatus,
  t: Translator,
  prefix?: string
): DocumentFragment {
  const status = localAppleStatusIndicator(sourceStatus, fallback, t);
  const fragment = document.createDocumentFragment();
  if (prefix) {
    fragment.append(prefix, " | ");
  }
  const indicator = document.createElement("span");
  indicator.className = `task-hub-setting-status ${status.cls}`;
  indicator.textContent = status.icon;
  indicator.setAttribute("aria-label", status.label);
  indicator.setAttribute("title", status.label);
  fragment.append(indicator, " ", status.label);
  return fragment;
}

type LocalAppleStatusIndicator = {
  cls: "is-ok" | "is-error" | "is-never";
  icon: string;
  label: string;
};

function localAppleStatusIndicator(
  sourceStatus: CalendarSourceStatus | undefined,
  fallback: LocalAppleSyncStatus,
  t: Translator
): LocalAppleStatusIndicator {
  if (sourceStatus?.state === "ok") {
    return {
      cls: "is-ok",
      icon: "✓",
      label: `${t("synced")}, ${sourceStatus.eventCount} ${t("events")}, ${sourceStatus.lastSyncedAt}`
    };
  }
  if (sourceStatus?.state === "error") {
    return {
      cls: "is-error",
      icon: "!",
      label: `${t("failedSync")}: ${localAppleMessage(sourceStatus.message, t)}`
    };
  }
  if (fallback.state === "ok") {
    return {
      cls: "is-ok",
      icon: "✓",
      label: `${t("synced")}, ${fallback.itemCount}, ${fallback.lastSyncedAt}`
    };
  }
  if (fallback.state === "error") {
    return {
      cls: "is-error",
      icon: "!",
      label: `${t("failedSync")}: ${localAppleMessage(fallback.message, t)}`
    };
  }
  return {
    cls: "is-never",
    icon: "•",
    label: t("neverSynced")
  };
}

function localAppleMessage(message: string, t: Translator): string {
  if (message.includes("helper is missing")) return `${t("localAppleHelperMissing")}: ${t("localAppleHelperMissingDesc")}`;
  if (message.includes("Permission has not been requested")) return t("localApplePermissionNotDetermined");
  if (message.includes("Permission denied")) return t("localApplePermissionDenied");
  if (message.includes("Permission is restricted")) return t("localApplePermissionRestricted");
  return message;
}

function errorTypeLabel(errorType: CalendarErrorType, t: Translator): string {
  if (errorType === "network_error") return t("networkError");
  if (errorType === "http_error") return t("httpError");
  if (errorType === "invalid_content") return t("invalidContent");
  if (errorType === "local_error") return t("localAppleError");
  return t("parseError");
}

function createCalendarSource(name: string, url: string): CalendarSource {
  return {
    id: `ics-${Date.now().toString(36)}`,
    name,
    type: "ics",
    url,
    color: "#3b82f6",
    enabled: true,
    refreshIntervalMinutes: 60,
    status: { state: "never" },
    cachedEvents: []
  };
}

function normalizeColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function mergeAppleCalendarsFromSettings(
  calendars: AppleCalendarInfo[],
  events: { calendarId?: string; calendarName?: string; calendarColor?: string }[]
): AppleCalendarInfo[] {
  const merged = new Map<string, AppleCalendarInfo>();
  for (const calendar of calendars) {
    merged.set(calendar.id, calendar);
  }
  for (const event of events) {
    if (!event.calendarId || !event.calendarName) continue;
    const existing = merged.get(event.calendarId);
    merged.set(event.calendarId, {
      id: event.calendarId,
      name: existing?.name ?? event.calendarName,
      color: existing?.color ?? event.calendarColor,
      writable: existing?.writable
    });
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function serializeCreationKind(kind: CalendarCreationKind): string {
  return kind;
}

export function parseCreationKind(value: string): CalendarCreationKind {
  return value === "event" ? "event" : "task";
}

export function serializeTaskCreationTarget(target: CalendarTaskCreationTarget): string {
  if (target.type === "apple-reminders") {
    return `apple-reminders:${target.listId ?? ""}`;
  }
  return "vault";
}

export function parseTaskCreationTarget(value: string): CalendarTaskCreationTarget {
  if (value.startsWith("apple-reminders:")) {
    const listId = value.slice("apple-reminders:".length);
    return { type: "apple-reminders", listId: listId || undefined };
  }
  return { type: "vault" };
}

export function serializeEventCreationTarget(target: CalendarEventCreationTarget): string {
  return `apple-calendar:${target.calendarId ?? ""}`;
}

export function parseEventCreationTarget(value: string): CalendarEventCreationTarget {
  if (value.startsWith("apple-calendar:")) {
    const calendarId = value.slice("apple-calendar:".length);
    return { type: "apple-calendar", calendarId: calendarId || undefined };
  }
  return { type: "apple-calendar" };
}

export function serializeCreationTarget(target: CalendarCreationTarget): string {
  return target.type === "apple-calendar" ? serializeEventCreationTarget(target) : serializeTaskCreationTarget(target);
}

export function parseCreationTarget(value: string, kind: CalendarCreationKind): CalendarCreationTarget {
  return kind === "event" ? parseEventCreationTarget(value) : parseTaskCreationTarget(value);
}

export function taskCreationTargetLabel(target: CalendarTaskCreationTarget, plugin: TaskHubPlugin, t: Translator): string {
  if (target.type === "vault") {
    return t("vaultTasks");
  }
  return appleReminderListName(target.listId, plugin) ?? t("localAppleRemindersDefaultListInbox");
}

export function eventCreationTargetLabel(target: CalendarEventCreationTarget, plugin: TaskHubPlugin, t: Translator): string {
  return appleCalendarName(target.calendarId, plugin) ?? t("localAppleCalendar");
}

export function creationTargetLabel(target: CalendarCreationTarget, plugin: TaskHubPlugin, t: Translator): string {
  return target.type === "apple-calendar" ? eventCreationTargetLabel(target, plugin, t) : taskCreationTargetLabel(target, plugin, t);
}

export function populateCreationKindDropdown(selectEl: HTMLSelectElement, t: Translator): void {
  selectEl.empty();
  selectEl.createEl("option", { value: "task", text: t("task") });
  selectEl.createEl("option", { value: "event", text: t("event") });
}

export function populateTaskCreationTargetDropdown(selectEl: HTMLSelectElement, plugin: TaskHubPlugin, t: Translator): void {
  selectEl.empty();
  selectEl.createEl("option", { value: "vault", text: t("vaultTasks") });
  if (plugin.canCreateAppleReminders()) {
    const lists = plugin.getAppleReminderLists();
    if (lists.length === 0) {
      selectEl.createEl("option", {
        value: "apple-reminders:",
        text: `${t("localAppleReminders")}: ${t("localAppleRemindersDefaultListInbox")}`
      });
    }
    for (const list of lists) {
      selectEl.createEl("option", {
        value: serializeTaskCreationTarget({ type: "apple-reminders", listId: list.id }),
        text: `${t("localAppleReminders")}: ${list.name}`
      });
    }
  }

}

export function populateEventCreationTargetDropdown(selectEl: HTMLSelectElement, plugin: TaskHubPlugin, t: Translator): void {
  selectEl.empty();
  if (!plugin.canSendTasksToAppleCalendar()) return;
  const calendars = plugin.getAppleCalendars().filter((calendar) => calendar.writable !== false);
  if (calendars.length === 0) {
    selectEl.createEl("option", {
      value: "apple-calendar:",
      text: t("localAppleCalendar")
    });
    return;
  }
  for (const calendar of calendars) {
    selectEl.createEl("option", {
      value: serializeEventCreationTarget({ type: "apple-calendar", calendarId: calendar.id }),
      text: `${t("localAppleCalendar")}: ${calendar.name}`
    });
  }
}

function populateAppleReminderListDropdown(selectEl: HTMLSelectElement, plugin: TaskHubPlugin, t: Translator): void {
  selectEl.empty();
  selectEl.createEl("option", { value: "", text: t("localAppleRemindersDefaultListInbox") });
  for (const list of plugin.getAppleReminderLists()) {
    selectEl.createEl("option", { value: list.id, text: list.name });
  }
}

function appleReminderListName(listId: string | undefined, plugin: TaskHubPlugin): string | undefined {
  if (!listId) return undefined;
  return plugin.getAppleReminderLists().find((list) => list.id === listId)?.name;
}

function appleCalendarName(calendarId: string | undefined, plugin: TaskHubPlugin): string | undefined {
  if (!calendarId) return undefined;
  return plugin.getAppleCalendars().find((calendar) => calendar.id === calendarId)?.name;
}
