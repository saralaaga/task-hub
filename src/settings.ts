import { App, PluginSettingTab, Setting } from "obsidian";
import { createTranslator, isLanguage, LANGUAGE_OPTIONS, type Translator } from "./i18n";
import type TaskHubPlugin from "./main";
import { DEFAULT_DIDA_API_BASE, DIDA_INBOX_PROJECT_NAME } from "./dida/didaMapping";
import { normalizeTaskSendDefaultTarget, parseTaskSendTarget, serializeTaskSendTarget, taskSendTargetOptions } from "./taskSendTargets";
import { validTimedDurationMinutes } from "./timeGranularity";
import type { AppleCalendarInfo, CalendarCreationKind, CalendarCreationTarget, CalendarEventCreationTarget, CalendarSource, CalendarSourceStatus, CalendarTaskCreationTarget, ExternalTaskShadowMetadata, ExternalTaskSourceTab, LocalAppleSyncStatus, PersistedVaultTaskStableRecord, TaskHubLastSessionState, TaskHubSettings } from "./types";
import { setCssProps } from "./views/domStyles";

export const TASK_HUB_SETTINGS_SCHEMA_VERSION = 5;

export const DEFAULT_SETTINGS: TaskHubSettings = {
  settingsSchemaVersion: TASK_HUB_SETTINGS_SCHEMA_VERSION,
  language: "en",
  defaultView: "tasks",
  lastSessionState: undefined,
  weekStart: "monday",
  showCompletedByDefault: false,
  showSubtaskProgressBars: true,
  showLunarCalendar: false,
  indexOnStartup: true,
  calendarTaskCreationEnabled: true,
  calendarCreationDefaultKind: "task",
  calendarTaskCreationDefaultTarget: { type: "vault" },
  calendarEventCreationDefaultTarget: { type: "apple-calendar" },
  taskSendDefaultTarget: undefined,
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
    showCountsInTaskList: true,
    showFrontmatterInNoteModal: false,
    linkedNoteSubtasksEnabled: false
  },
  taskViewFilters: {
    status: "open",
    tags: [],
    tagQuery: "",
    sourceQuery: "",
    textQuery: ""
  },
  taskListManualOrder: {},
  taskNoteManualOrder: {},
  taskNotePinned: {},
  smartLists: [],
  vaultTaskStableState: {},
  externalTaskLookbackDays: 100,
  externalTaskLookaheadDays: 100,
  externalTaskMetadata: {},
  ignoredPaths: ["Templates/", "Archive/"],
  tagViewOrder: [],
  calendarSources: [],
  externalTaskSourceOrder: ["apple-calendar", "apple-reminders", "dida"],
  appleReminderLinks: {},
  didaTaskLinks: {},
  dida: {
    enabled: false,
    tasksEnabled: false,
    tasksColor: "#3b82f6",
    taskColorOverrides: {},
    tasksWritebackEnabled: false,
    tasksCreateEnabled: false,
    tasksDragRescheduleEnabled: false,
    tasksDeleteEnabled: false,
    tasksCreateTagsEnabled: true,
    defaultProjectId: undefined,
    projects: [],
    apiBase: DEFAULT_DIDA_API_BASE,
    apiToken: "",
    syncStatus: { state: "never" },
    defaultReminderOffsetMinutes: 0
  },
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
  const loadedDida = loaded?.dida as Partial<TaskHubSettings["dida"]> | undefined;
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
    language: isLanguage(loaded?.language) ? loaded.language : DEFAULT_SETTINGS.language,
    defaultView: normalizeDefaultView(loaded?.defaultView),
    lastSessionState: normalizeTaskHubLastSessionState(loaded?.lastSessionState, loaded?.defaultView, loaded?.taskViewFilters, loaded?.showCompletedByDefault),
    calendarTaskCreationEnabled: loaded?.calendarTaskCreationEnabled ?? DEFAULT_SETTINGS.calendarTaskCreationEnabled,
    calendarCreationDefaultKind: loaded?.calendarCreationDefaultKind ?? DEFAULT_SETTINGS.calendarCreationDefaultKind,
    calendarTimeScale: normalizeCalendarTimeScale(loaded?.calendarTimeScale),
    ...normalizeCalendarDayHours(loaded?.calendarDayStartHour, loaded?.calendarDayEndHour),
    showLunarCalendar: loaded?.showLunarCalendar ?? DEFAULT_SETTINGS.showLunarCalendar,
    calendarTaskCreationDefaultTarget:
      loaded?.calendarTaskCreationDefaultTarget ?? DEFAULT_SETTINGS.calendarTaskCreationDefaultTarget,
    calendarEventCreationDefaultTarget:
      loaded?.calendarEventCreationDefaultTarget ?? DEFAULT_SETTINGS.calendarEventCreationDefaultTarget,
    taskSendDefaultTarget: normalizeTaskSendDefaultTarget(loaded?.taskSendDefaultTarget, {
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        ...(loadedLocalApple ?? {}),
        enabled: localAppleEnabled,
        remindersLists: normalizeAppleReminderLists(loadedLocalApple?.remindersLists)
      },
      dida: {
        ...DEFAULT_SETTINGS.dida,
        ...(loadedDida ?? {}),
        enabled: loadedDida?.enabled ?? DEFAULT_SETTINGS.dida.enabled,
        tasksCreateEnabled: loadedDida?.tasksCreateEnabled ?? DEFAULT_SETTINGS.dida.tasksCreateEnabled,
        apiToken: loadedDida?.apiToken ?? DEFAULT_SETTINGS.dida.apiToken,
        projects: normalizeDidaProjects(loadedDida?.projects)
      }
    }),
    taskCreationFilePath: loaded?.taskCreationFilePath ?? DEFAULT_SETTINGS.taskCreationFilePath,
    taskNotes: normalizeTaskNotesSettings(loaded?.taskNotes),
    taskViewFilters: normalizeTaskViewFilters(loaded?.taskViewFilters, loaded?.showCompletedByDefault),
    taskListManualOrder: normalizeTaskListManualOrder(loaded?.taskListManualOrder),
    taskNoteManualOrder: normalizeTaskNoteManualOrder(loaded?.taskNoteManualOrder),
    taskNotePinned: normalizeTaskNotePinned(loaded?.taskNotePinned),
    smartLists: normalizeSmartLists(loaded?.smartLists, loaded?.showCompletedByDefault),
    vaultTaskStableState: normalizeVaultTaskStableState(loaded?.vaultTaskStableState),
    externalTaskLookbackDays: normalizeWindowDays(loaded?.externalTaskLookbackDays, DEFAULT_SETTINGS.externalTaskLookbackDays),
    externalTaskLookaheadDays: normalizeWindowDays(loaded?.externalTaskLookaheadDays, DEFAULT_SETTINGS.externalTaskLookaheadDays),
    externalTaskMetadata: normalizeExternalTaskMetadata(loaded?.externalTaskMetadata),
    externalTaskSourceOrder: normalizeExternalTaskSourceOrder(loaded?.externalTaskSourceOrder),
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
      remindersLists: normalizeAppleReminderLists(loadedLocalApple?.remindersLists),
      calendarColor: loadedLocalApple?.calendarColor ?? DEFAULT_SETTINGS.localApple.calendarColor,
      calendarColorOverrides: loadedLocalApple?.calendarColorOverrides ?? DEFAULT_SETTINGS.localApple.calendarColorOverrides,
      calendars: loadedLocalApple?.calendars ?? DEFAULT_SETTINGS.localApple.calendars,
      calendarDefaultTimedTaskDurationMinutes: validTimedDurationMinutes(
        loadedLocalApple?.calendarDefaultTimedTaskDurationMinutes,
        DEFAULT_SETTINGS.localApple.calendarDefaultTimedTaskDurationMinutes
      )
    },
    dida: {
      ...DEFAULT_SETTINGS.dida,
      ...(loadedDida ?? {}),
      enabled: loadedDida?.enabled ?? DEFAULT_SETTINGS.dida.enabled,
      tasksEnabled: loadedDida?.tasksEnabled ?? DEFAULT_SETTINGS.dida.tasksEnabled,
      tasksColor: loadedDida?.tasksColor ?? DEFAULT_SETTINGS.dida.tasksColor,
      taskColorOverrides: loadedDida?.taskColorOverrides ?? DEFAULT_SETTINGS.dida.taskColorOverrides,
      projects: normalizeDidaProjects(loadedDida?.projects),
      apiBase: normalizeDidaApiBase(loadedDida?.apiBase),
      apiToken: loadedDida?.apiToken ?? DEFAULT_SETTINGS.dida.apiToken,
      syncStatus: loadedDida?.syncStatus ?? DEFAULT_SETTINGS.dida.syncStatus,
      defaultReminderOffsetMinutes:
        typeof loadedDida?.defaultReminderOffsetMinutes === "number"
          ? loadedDida.defaultReminderOffsetMinutes
          : DEFAULT_SETTINGS.dida.defaultReminderOffsetMinutes
    },
    appleReminderLinks: loaded?.appleReminderLinks ?? {},
    didaTaskLinks: loaded?.didaTaskLinks ?? {}
  };
}

function normalizeTaskListManualOrder(value: unknown): TaskHubSettings["taskListManualOrder"] {
  if (!value || typeof value !== "object") return {};
  const result: TaskHubSettings["taskListManualOrder"] = {};
  for (const [dateKey, stableIds] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateKey) || !Array.isArray(stableIds)) continue;
    const normalized = Array.from(
      new Set(stableIds.filter((stableId): stableId is string => isTaskStableId(stableId)))
    );
    if (normalized.length > 0) result[dateKey] = normalized;
  }
  return result;
}

function normalizeTaskNoteManualOrder(value: unknown): TaskHubSettings["taskNoteManualOrder"] {
  if (!value || typeof value !== "object") return {};
  const result: TaskHubSettings["taskNoteManualOrder"] = {};
  for (const [scopeKey, noteKeys] of Object.entries(value as Record<string, unknown>)) {
    if (typeof scopeKey !== "string" || !scopeKey.trim() || !Array.isArray(noteKeys)) continue;
    const normalized = Array.from(
      new Set(noteKeys.filter((noteKey): noteKey is string => typeof noteKey === "string" && noteKey.trim().length > 0))
    );
    if (normalized.length > 0) result[scopeKey] = normalized;
  }
  return result;
}

function normalizeTaskNotePinned(value: unknown): TaskHubSettings["taskNotePinned"] {
  if (!value || typeof value !== "object") return {};
  const result: TaskHubSettings["taskNotePinned"] = {};
  for (const [scopeKey, noteKeys] of Object.entries(value as Record<string, unknown>)) {
    if (typeof scopeKey !== "string" || !scopeKey.trim() || !Array.isArray(noteKeys)) continue;
    const normalized = Array.from(
      new Set(noteKeys.filter((noteKey): noteKey is string => typeof noteKey === "string" && noteKey.trim().length > 0))
    );
    if (normalized.length > 0) result[scopeKey] = normalized;
  }
  return result;
}

function normalizeSmartLists(value: unknown, showCompletedByDefault: boolean | undefined): TaskHubSettings["smartLists"] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const result: TaskHubSettings["smartLists"] = [];
  for (const item of value) {
    const normalized = normalizeSmartList(item, showCompletedByDefault);
    if (!normalized || seenIds.has(normalized.id)) continue;
    seenIds.add(normalized.id);
    result.push(normalized);
    if (result.length >= 100) break;
  }
  return result;
}

function normalizeSmartList(value: unknown, showCompletedByDefault: boolean | undefined): TaskHubSettings["smartLists"][number] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const color = normalizeSmartListColor(candidate.color);
  const createdAt = normalizeSmartListTimestamp(candidate.createdAt);
  const updatedAt = normalizeSmartListTimestamp(candidate.updatedAt);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(id) || !name || !createdAt || !updatedAt) return undefined;
  return {
    id,
    name,
    ...(color ? { color } : {}),
    filters: normalizeTaskViewFilters(candidate.filters as Partial<TaskHubSettings["taskViewFilters"]> | undefined, showCompletedByDefault),
    taskStableIds: normalizeSmartListStableIds(candidate.taskStableIds),
    taskIds: normalizeSmartListTaskIds(candidate.taskIds),
    excludedTaskStableIds: normalizeSmartListStableIds(candidate.excludedTaskStableIds),
    excludedTaskIds: normalizeSmartListTaskIds(candidate.excludedTaskIds),
    createdAt,
    updatedAt
  };
}

function normalizeSmartListColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/u.test(trimmed) ? trimmed : undefined;
}

function normalizeSmartListTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function normalizeSmartListStableIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((stableId): stableId is string => isTaskStableId(stableId)))).slice(0, 500);
}

function normalizeSmartListTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((taskId): taskId is string => typeof taskId === "string" && taskId.trim().length > 0).map((taskId) => taskId.trim()))
  ).slice(0, 500);
}

function normalizeVaultTaskStableState(value: unknown): TaskHubSettings["vaultTaskStableState"] {
  if (!value || typeof value !== "object") return {};
  const result: TaskHubSettings["vaultTaskStableState"] = {};
  for (const [path, records] of Object.entries(value as Record<string, unknown>)) {
    if (typeof path !== "string" || !Array.isArray(records)) continue;
    const normalized = records
      .map(normalizeVaultTaskStableRecord)
      .filter((record): record is PersistedVaultTaskStableRecord => Boolean(record))
      .slice(0, 1000);
    if (normalized.length > 0) result[path] = normalized;
  }
  return result;
}

function normalizeVaultTaskStableRecord(value: unknown): PersistedVaultTaskStableRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    !isTaskStableId(candidate.stableId) ||
    typeof candidate.currentId !== "string" ||
    typeof candidate.text !== "string" ||
    typeof candidate.line !== "number" ||
    !Array.isArray(candidate.tags) ||
    typeof candidate.completed !== "boolean"
  ) {
    return undefined;
  }
  return {
    stableId: candidate.stableId,
    currentId: candidate.currentId,
    text: candidate.text,
    line: Math.max(0, Math.floor(candidate.line)),
    heading: typeof candidate.heading === "string" ? candidate.heading : undefined,
    indent: typeof candidate.indent === "number" ? Math.max(0, Math.floor(candidate.indent)) : undefined,
    dueDate: typeof candidate.dueDate === "string" ? candidate.dueDate : undefined,
    scheduledDate: typeof candidate.scheduledDate === "string" ? candidate.scheduledDate : undefined,
    startDate: typeof candidate.startDate === "string" ? candidate.startDate : undefined,
    tags: Array.from(new Set(candidate.tags.filter((tag): tag is string => typeof tag === "string"))),
    completed: candidate.completed
  };
}

function normalizeExternalTaskMetadata(value: unknown): TaskHubSettings["externalTaskMetadata"] {
  if (!value || typeof value !== "object") return {};
  const result: TaskHubSettings["externalTaskMetadata"] = {};
  for (const [stableId, metadata] of Object.entries(value as Record<string, unknown>)) {
    if (!isTaskStableId(stableId)) continue;
    const normalized = normalizeExternalTaskMetadataRecord(metadata);
    if (normalized) result[stableId] = normalized;
  }
  return result;
}

function normalizeExternalTaskMetadataRecord(value: unknown): ExternalTaskShadowMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const startDate = typeof candidate.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(candidate.startDate)
    ? candidate.startDate
    : undefined;
  const lastSeenAt = typeof candidate.lastSeenAt === "string" && !Number.isNaN(Date.parse(candidate.lastSeenAt))
    ? candidate.lastSeenAt
    : undefined;
  if (!startDate && !lastSeenAt) return undefined;
  return { startDate, lastSeenAt };
}

function normalizeWindowDays(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(3650, Math.floor(value)));
}

function isTaskStableId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^(vault:th_[a-z0-9]+|[a-z0-9-]+:.+)$/u.test(value);
}

function normalizeExternalTaskSourceOrder(value: unknown): ExternalTaskSourceTab[] {
  const defaults = DEFAULT_SETTINGS.externalTaskSourceOrder;
  if (!Array.isArray(value)) return defaults;
  const known = value.filter((item): item is ExternalTaskSourceTab =>
    item === "apple-calendar" || item === "apple-reminders" || item === "dida"
  );
  return [...known, ...defaults.filter((item) => !known.includes(item))];
}

function normalizeDidaApiBase(value: unknown): string {
  return typeof value === "string" && /^https:\/\/.+/u.test(value.trim())
    ? value.trim().replace(/\/+$/u, "")
    : DEFAULT_SETTINGS.dida.apiBase;
}

function normalizeDidaProjects(value: unknown): TaskHubSettings["dida"]["projects"] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.dida.projects;
  return value
    .filter(isDidaProjectSetting)
    .map((project) => ({
      id: project.id,
      name: project.name === "未在清单中" ? DIDA_INBOX_PROJECT_NAME : project.name
    }));
}

function isDidaProjectSetting(value: unknown): value is { id: string; name: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.name === "string";
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
    thinoFolder: loaded?.thinoFolder ?? DEFAULT_SETTINGS.taskNotes.thinoFolder,
    showFrontmatterInNoteModal: loaded?.showFrontmatterInNoteModal ?? DEFAULT_SETTINGS.taskNotes.showFrontmatterInNoteModal,
    linkedNoteSubtasksEnabled: loaded?.linkedNoteSubtasksEnabled ?? DEFAULT_SETTINGS.taskNotes.linkedNoteSubtasksEnabled
  };
}

function normalizeAppleReminderLists(loaded: unknown): TaskHubSettings["localApple"]["remindersLists"] {
  if (!Array.isArray(loaded)) return DEFAULT_SETTINGS.localApple.remindersLists;
  return loaded
    .filter((list): list is { id?: unknown; name?: unknown; sourceId?: unknown; sourceName?: unknown } => Boolean(list) && typeof list === "object")
    .map((list) => ({
      id: typeof list.id === "string" ? list.id : "",
      name: typeof list.name === "string" ? list.name : "",
      sourceId: typeof list.sourceId === "string" ? list.sourceId : undefined,
      sourceName: typeof list.sourceName === "string" ? list.sourceName : undefined
    }))
    .filter((list) => list.id.length > 0 && list.name.length > 0);
}

function normalizeTaskHubLastSessionState(
  loaded: unknown,
  defaultView: unknown,
  taskViewFilters: Partial<TaskHubSettings["taskViewFilters"]> | undefined,
  showCompletedByDefault: boolean | undefined
): TaskHubSettings["lastSessionState"] {
  if (!loaded || typeof loaded !== "object") return undefined;
  const candidate = loaded as Partial<TaskHubLastSessionState>;
  const view = candidate.view === "tasks" || candidate.view === "calendar" || candidate.view === "tags"
    ? candidate.view
    : normalizeDefaultView(defaultView);
  const calendarMode =
    candidate.calendarMode === "day" || candidate.calendarMode === "week" || candidate.calendarMode === "month"
      ? candidate.calendarMode
      : "month";
  const calendarFocusDate = normalizePersistedDate(candidate.calendarFocusDate);
  return {
    view,
    taskViewFilters: normalizeTaskViewFilters(candidate.taskViewFilters ?? taskViewFilters, showCompletedByDefault),
    calendarMode,
    ...(calendarFocusDate ? { calendarFocusDate } : {}),
    visibleSourceIds: normalizeVisibleSourceIds(candidate.visibleSourceIds),
    unscheduledPanelOpen: typeof candidate.unscheduledPanelOpen === "boolean" ? candidate.unscheduledPanelOpen : false
  };
}

function normalizeDefaultView(value: unknown): TaskHubSettings["defaultView"] {
  return value === "calendar" || value === "tags" || value === "tasks" ? value : DEFAULT_SETTINGS.defaultView;
}

function normalizePersistedDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeVisibleSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return ["vault"];
  const visibleSourceIds = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return visibleSourceIds.length > 0 ? visibleSourceIds : ["vault"];
}

function normalizeTaskViewFilters(
  loaded: Partial<TaskHubSettings["taskViewFilters"]> | undefined,
  showCompletedByDefault: boolean | undefined
): TaskHubSettings["taskViewFilters"] {
  const dateBucket = normalizeStoredDateBucket(loaded?.dateBucket);
  return {
    ...DEFAULT_SETTINGS.taskViewFilters,
    ...(loaded ?? {}),
    status:
      loaded?.status === "open" || loaded?.status === "completed" || loaded?.status === "all"
        ? loaded.status
        : showCompletedByDefault
          ? "all"
          : DEFAULT_SETTINGS.taskViewFilters.status,
    ...(dateBucket ? { dateBucket } : { dateBucket: undefined }),
    tags: Array.isArray(loaded?.tags)
      ? loaded.tags.filter((tag): tag is string => typeof tag === "string")
      : DEFAULT_SETTINGS.taskViewFilters.tags,
    tagQuery: typeof loaded?.tagQuery === "string" ? loaded.tagQuery : DEFAULT_SETTINGS.taskViewFilters.tagQuery,
    sourceQuery: typeof loaded?.sourceQuery === "string" ? loaded.sourceQuery : DEFAULT_SETTINGS.taskViewFilters.sourceQuery,
    textQuery: typeof loaded?.textQuery === "string" ? loaded.textQuery : DEFAULT_SETTINGS.taskViewFilters.textQuery,
    conditions: loaded?.conditions
      ? {
          operator: loaded.conditions.operator === "or" ? "or" : "and",
          tag: typeof loaded.conditions.tag === "string" ? loaded.conditions.tag : "",
          dateBucket: normalizeStoredDateBucket(loaded.conditions.dateBucket) ?? "",
          text: typeof loaded.conditions.text === "string" ? loaded.conditions.text : ""
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

export function openTaskHubFeedback(openUrl: (url: string) => void): void {
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
          .onClick(() => openTaskHubFeedback((url) => containerEl.win.open(url)));
      });

    const basicSettingsGrid = containerEl.createDiv({ cls: "task-hub-settings-grid" });

    new Setting(basicSettingsGrid)
      .setName(t("language"))
      .setDesc(t("languageDesc"))
      .addDropdown((dropdown) => {
        for (const option of LANGUAGE_OPTIONS) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = isLanguage(value) ? value : DEFAULT_SETTINGS.language;
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

    new Setting(basicSettingsGrid)
      .setName(t("showSubtaskProgressBars"))
      .setDesc(t("showSubtaskProgressBarsDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showSubtaskProgressBars).onChange(async (value) => {
          this.plugin.settings.showSubtaskProgressBars = value;
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

    const sendTargetOptions = currentTaskSendTargetOptions(this.plugin, t);
    if (sendTargetOptions.length > 0) {
      new Setting(basicSettingsGrid)
        .setName(t("taskSendDefaultTarget"))
        .setDesc(t("taskSendDefaultTargetDesc"))
        .addDropdown((dropdown) => {
          dropdown.selectEl.empty();
          for (const option of sendTargetOptions) {
            dropdown.addOption(option.value, option.label);
          }
          const currentValue = this.plugin.settings.taskSendDefaultTarget
            ? serializeTaskSendTarget(this.plugin.settings.taskSendDefaultTarget)
            : sendTargetOptions[0].value;
          dropdown.setValue(sendTargetOptions.some((option) => option.value === currentValue) ? currentValue : sendTargetOptions[0].value)
            .onChange(async (value) => {
              this.plugin.settings.taskSendDefaultTarget = parseTaskSendTarget(value);
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

      new Setting(taskNotesGrid)
        .setName(t("taskNotesLinkedSubtasks"))
        .setDesc(t("taskNotesLinkedSubtasksDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.taskNotes.linkedNoteSubtasksEnabled).onChange(async (value) => {
            this.plugin.settings.taskNotes.linkedNoteSubtasksEnabled = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(taskNotesGrid)
        .setName(t("taskNotesShowFrontmatter"))
        .setDesc(t("taskNotesShowFrontmatterDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.taskNotes.showFrontmatterInNoteModal).onChange(async (value) => {
            this.plugin.settings.taskNotes.showFrontmatterInNoteModal = value;
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
    this.displayExternalTaskSources(containerEl);
    if (scrollTop !== undefined) {
      containerEl.scrollTop = scrollTop;
    }
  }

  private displayDida(containerEl: HTMLElement, options: { heading?: boolean } = {}): void {
    const t = createTranslator(this.plugin.settings.language);
    if (options.heading) {
      new Setting(containerEl).setName(t("dida")).setDesc(t("didaDesc")).setHeading();
    }

    new Setting(containerEl)
      .setName(t("didaEnable"))
      .setDesc(this.plugin.settings.dida.enabled ? createCalendarSourceStatusText(this.plugin.settings.dida.syncStatus, t) : t("didaDisabledDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.enabled).onChange(async (value) => {
          this.plugin.settings.dida.enabled = value;
          if (!value) {
            this.plugin.settings.dida.tasksEnabled = false;
            this.plugin.settings.dida.tasksWritebackEnabled = false;
            this.plugin.settings.dida.tasksCreateEnabled = false;
            this.plugin.settings.dida.tasksDragRescheduleEnabled = false;
            this.plugin.settings.dida.tasksDeleteEnabled = false;
          }
          await this.plugin.saveSettings();
          await this.plugin.syncDida({ silent: true });
          this.display({ preserveScroll: true });
        });
      })
      .addButton((button) => {
        button
          .setButtonText(t("didaTestConnection"))
          .setDisabled(!this.plugin.settings.dida.enabled || !this.plugin.settings.dida.apiToken.trim())
          .onClick(async () => {
            await this.plugin.syncDida({ silent: false });
            this.display({ preserveScroll: true });
          });
      });

    if (!this.plugin.settings.dida.enabled) return;

    const grid = containerEl.createDiv({ cls: "task-hub-settings-grid" });
    new Setting(grid)
      .setName(t("didaApiBase"))
      .setDesc(t("didaApiBaseDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("https://api.dida365.com", t("didaApiBaseDida"))
          .addOption("https://api.ticktick.com", t("didaApiBaseTickTick"))
          .setValue(this.plugin.settings.dida.apiBase)
          .onChange(async (value) => {
            this.plugin.settings.dida.apiBase = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(grid)
      .setName(t("didaApiToken"))
      .setDesc(t("didaApiTokenDesc"))
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("dp_...").setValue(this.plugin.settings.dida.apiToken).onChange(async (value) => {
          this.plugin.settings.dida.apiToken = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(grid)
      .setName(t("didaTasks"))
      .setDesc(t("didaTasksDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.tasksEnabled).onChange(async (value) => {
          this.plugin.settings.dida.tasksEnabled = value;
          if (!value) {
            this.plugin.settings.dida.tasksWritebackEnabled = false;
            this.plugin.settings.dida.tasksCreateEnabled = false;
            this.plugin.settings.dida.tasksDragRescheduleEnabled = false;
            this.plugin.settings.dida.tasksDeleteEnabled = false;
          }
          await this.plugin.saveSettings();
          await this.plugin.syncDida({ silent: true });
          this.display({ preserveScroll: true });
        });
      });
  }

  private displayDidaWritebackSettings(containerEl: HTMLElement, t: Translator): void {
    new Setting(containerEl)
      .setName(t("didaWriteback"))
      .setDesc(t("didaWritebackDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.tasksWritebackEnabled).onChange(async (value) => {
          this.plugin.settings.dida.tasksWritebackEnabled = value;
          if (!value) this.plugin.settings.dida.tasksDragRescheduleEnabled = false;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(containerEl)
      .setName(t("didaDragReschedule"))
      .setDesc(t("didaDragRescheduleDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.tasksDragRescheduleEnabled).onChange(async (value) => {
          this.plugin.settings.dida.tasksDragRescheduleEnabled = value && this.plugin.settings.dida.tasksWritebackEnabled;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(containerEl)
      .setName(t("didaDelete"))
      .setDesc(t("didaDeleteDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.tasksDeleteEnabled).onChange(async (value) => {
          if (value && !(await this.plugin.confirmRiskySourceDeletionSetting())) {
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.dida.tasksDeleteEnabled = value;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    new Setting(containerEl)
      .setName(t("didaCreate"))
      .setDesc(t("didaCreateDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.dida.tasksCreateEnabled).onChange(async (value) => {
          if (value && !(await this.plugin.confirmRiskySourceDeletionSetting())) {
            this.display({ preserveScroll: true });
            return;
          }
          this.plugin.settings.dida.tasksCreateEnabled = value;
          await this.plugin.saveSettings();
          this.display({ preserveScroll: true });
        });
      });

    if (this.plugin.settings.dida.tasksCreateEnabled) {
      new Setting(containerEl)
        .setName(t("didaCreateTags"))
        .setDesc(t("didaCreateTagsDesc"))
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.dida.tasksCreateTagsEnabled).onChange(async (value) => {
            this.plugin.settings.dida.tasksCreateTagsEnabled = value;
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName(t("didaDefaultProject"))
        .setDesc(t("didaDefaultProjectDesc"))
        .addDropdown((dropdown) => {
          populateDidaProjectDropdown(dropdown.selectEl, this.plugin, t);
          dropdown.setValue(this.plugin.settings.dida.defaultProjectId ?? "").onChange(async (value) => {
            this.plugin.settings.dida.defaultProjectId = value || undefined;
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName(t("didaDefaultReminder"))
        .setDesc(t("didaDefaultReminderDesc"))
        .addText((text) => {
          text.setPlaceholder("0").setValue(String(this.plugin.settings.dida.defaultReminderOffsetMinutes ?? 0)).onChange(async (value) => {
            const minutes = Number.parseInt(value, 10);
            if (Number.isFinite(minutes) && minutes >= 0 && minutes <= 10080) {
              this.plugin.settings.dida.defaultReminderOffsetMinutes = minutes;
              await this.plugin.saveSettings();
            }
          });
        });
    }
  }

  private displayDidaProjectColorOverrides(containerEl: HTMLElement, t: Translator): void {
    const projects = this.plugin.getDidaProjects();
    if (projects.length === 0) {
      containerEl.createDiv({ cls: "task-hub-empty", text: t("didaProjectColorNoProjects") });
      return;
    }
    new Setting(containerEl).setName(t("didaProjectColors")).setDesc(t("didaProjectColorsDesc")).setHeading();
    for (const project of projects) {
      const value = this.plugin.settings.dida.taskColorOverrides[project.id] ?? this.plugin.settings.dida.tasksColor;
      this.displayLocalAppleColorSetting(
        containerEl,
        t,
        project.name,
        `${t("didaProject")}: ${project.name}`,
        value,
        this.plugin.settings.dida.tasksColor,
        (color) => {
          this.plugin.settings.dida.taskColorOverrides = {
            ...this.plugin.settings.dida.taskColorOverrides,
            [project.id]: color
          };
        }
      );
    }
  }

  private displayExternalTaskSources(containerEl: HTMLElement): void {
    const t = createTranslator(this.plugin.settings.language);
    new Setting(containerEl).setName(t("externalTaskSources")).setDesc(t("externalTaskSourcesDesc")).setHeading();

    new Setting(containerEl)
      .setName(t("externalTaskLookback"))
      .setDesc(t("externalTaskLookbackDesc"))
      .addText((text) => {
        text.setValue(String(this.plugin.settings.externalTaskLookbackDays)).onChange(async (value) => {
          const days = Number.parseInt(value, 10);
          if (Number.isFinite(days) && days >= 0) {
            this.plugin.settings.externalTaskLookbackDays = days;
            await this.plugin.saveSettings();
            await this.plugin.syncExternalTasks({ silent: true });
            this.display({ preserveScroll: true });
          }
        });
      });

    new Setting(containerEl)
      .setName(t("externalTaskLookahead"))
      .setDesc(t("externalTaskLookaheadDesc"))
      .addText((text) => {
        text.setValue(String(this.plugin.settings.externalTaskLookaheadDays)).onChange(async (value) => {
          const days = Number.parseInt(value, 10);
          if (Number.isFinite(days) && days >= 0) {
            this.plugin.settings.externalTaskLookaheadDays = days;
            await this.plugin.saveSettings();
            await this.plugin.syncExternalTasks({ silent: true });
            this.display({ preserveScroll: true });
          }
        });
      });

    this.displayLocalApple(containerEl, { tabs: false });
    this.displayDida(containerEl);

    const tabs = this.enabledExternalTaskSourceTabs();
    if (tabs.length === 0) {
      containerEl.createDiv({ cls: "task-hub-empty", text: t("externalTaskSourcesEmpty") });
      return;
    }

    const activeTab = this.activeExternalTaskSourceTab(tabs);
    const tabList = containerEl.createDiv({ cls: "task-hub-settings-tab-list" });
    for (const tab of tabs) {
      const button = tabList.createEl("button", {
        cls: `task-hub-settings-tab ${tab === activeTab ? "is-active" : ""}`,
        text: this.externalTaskSourceTabLabel(tab, t),
        attr: {
          type: "button",
          draggable: "true"
        }
      });
      button.addEventListener("click", () => {
        this.externalTaskSourceTab = tab;
        this.display({ preserveScroll: true });
      });
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/task-hub-external-tab", tab);
        button.addClass("is-dragging");
      });
      button.addEventListener("dragend", () => {
        button.removeClass("is-dragging");
      });
      button.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        const source = event.dataTransfer?.getData("text/task-hub-external-tab") as ExternalTaskSourceTab | undefined;
        if (!source || source === tab) return;
        void this.reorderExternalTaskSourceTabs(source, tab);
      });
    }

    const panel = containerEl.createDiv({ cls: "task-hub-settings-tab-panel" });
    if (activeTab === "apple-calendar") this.displayAppleCalendarTab(panel, t);
    else if (activeTab === "apple-reminders") this.displayAppleRemindersTab(panel, t);
    else this.displayDidaTab(panel, t);
  }

  private displayDidaTab(panel: HTMLElement, t: Translator): void {
    if (!this.plugin.settings.dida.enabled) {
      panel.createDiv({ cls: "task-hub-empty", text: t("didaDisabledDesc") });
      return;
    }
    if (!this.plugin.settings.dida.tasksEnabled) {
      panel.createDiv({ cls: "task-hub-empty", text: t("didaTasksDesc") });
      return;
    }
    this.displayDidaProjectColorOverrides(panel, t);
    this.displayDidaWritebackSettings(panel, t);
  }

  private enabledExternalTaskSourceTabs(): ExternalTaskSourceTab[] {
    const enabled: ExternalTaskSourceTab[] = [
      this.plugin.settings.localApple.enabled && this.plugin.settings.localApple.calendarEnabled ? "apple-calendar" : undefined,
      this.plugin.settings.localApple.enabled && this.plugin.settings.localApple.remindersEnabled ? "apple-reminders" : undefined,
      this.plugin.settings.dida.enabled && this.plugin.settings.dida.tasksEnabled ? "dida" : undefined
    ].filter((tab): tab is ExternalTaskSourceTab => Boolean(tab));
    return this.plugin.settings.externalTaskSourceOrder.filter((tab) => enabled.includes(tab));
  }

  private activeExternalTaskSourceTab(tabs: ExternalTaskSourceTab[]): ExternalTaskSourceTab {
    if (tabs.includes(this.externalTaskSourceTab)) return this.externalTaskSourceTab;
    this.externalTaskSourceTab = tabs[0];
    return this.externalTaskSourceTab;
  }

  private externalTaskSourceTabLabel(tab: ExternalTaskSourceTab, t: Translator): string {
    if (tab === "apple-calendar") return t("localAppleCalendar");
    if (tab === "apple-reminders") return t("localAppleReminders");
    return t("dida");
  }

  private async reorderExternalTaskSourceTabs(source: ExternalTaskSourceTab, target: ExternalTaskSourceTab): Promise<void> {
    const order = [...this.plugin.settings.externalTaskSourceOrder];
    const sourceIndex = order.indexOf(source);
    const targetIndex = order.indexOf(target);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;
    const [moved] = order.splice(sourceIndex, 1);
    order.splice(targetIndex, 0, moved);
    this.plugin.settings.externalTaskSourceOrder = order;
    await this.plugin.saveSettings();
    this.display({ preserveScroll: true });
  }

  private externalTaskSourceTab: ExternalTaskSourceTab = "apple-calendar";

  private displayLocalApple(containerEl: HTMLElement, options: { heading?: boolean; tabs?: boolean } = {}): void {
    const t = createTranslator(this.plugin.settings.language);
    if (options.heading) {
      new Setting(containerEl).setName(t("localApple")).setDesc(t("localAppleDesc")).setHeading();
    }

    new Setting(containerEl)
      .setName(t("localApple"))
      .setDesc(this.plugin.settings.localApple.enabled ? createLocalAppleStatusFragment(containerEl.doc, undefined, this.plugin.localAppleStatus, t) : t("localAppleDisabledDesc"))
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
      .setDesc(createLocalAppleStatusFragment(containerEl.doc, this.plugin.localAppleStatus.calendar, this.plugin.localAppleStatus, t, t("localAppleCalendarDesc")))
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
          ? createLocalAppleStatusFragment(containerEl.doc, this.plugin.localAppleStatus.reminders, this.plugin.localAppleStatus, t, t("localAppleRemindersDesc"))
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

    if (options.tabs === false) return;

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
          if (Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440) {
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
          setCssProps(icon, { "--task-hub-color-preview": color });
          icon.setAttribute("aria-label", `${name}: ${color}`);
          picker.value = normalizeColor(color, fallback);
        };
        button.setIcon("circle").setTooltip(name);
        icon.addClass("task-hub-color-preview");
        setPreview(value);
        picker.addEventListener("input", () => {
          setColor(normalizeColor(picker.value, fallback));
          void this.plugin.saveSettings().then(() => {
            this.display({ preserveScroll: true });
          });
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
          setCssProps(swatch, { "--task-hub-swatch-color": color });
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
  ownerDocument: Document,
  sourceStatus: CalendarSourceStatus | undefined,
  fallback: LocalAppleSyncStatus,
  t: Translator,
  prefix?: string
): DocumentFragment {
  const status = localAppleStatusIndicator(sourceStatus, fallback, t);
  const fragment = ownerDocument.createDocumentFragment();
  if (prefix) {
    fragment.append(prefix, " | ");
  }
  const indicator = ownerDocument.createElement("span");
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
  if (target.type === "dida") {
    return `dida:${target.projectId ?? ""}`;
  }
  return "vault";
}

export function parseTaskCreationTarget(value: string): CalendarTaskCreationTarget {
  if (value.startsWith("apple-reminders:")) {
    const listId = value.slice("apple-reminders:".length);
    return { type: "apple-reminders", listId: listId || undefined };
  }
  if (value.startsWith("dida:")) {
    const projectId = value.slice("dida:".length);
    return { type: "dida", projectId: projectId || undefined };
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
  if (target.type === "dida") {
    return didaProjectName(target.projectId, plugin) ?? t("didaDefaultProjectInbox");
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
  if (plugin.canCreateDidaTasks()) {
    const projects = plugin.getDidaProjects();
    for (const project of projects) {
      selectEl.createEl("option", {
        value: serializeTaskCreationTarget({ type: "dida", projectId: project.id }),
        text: `${t("dida")}: ${project.name}`
      });
    }
  }

}

export function populateTaskSendTargetDropdown(selectEl: HTMLSelectElement, plugin: TaskHubPlugin, t: Translator): void {
  selectEl.empty();
  for (const option of currentTaskSendTargetOptions(plugin, t)) {
    selectEl.createEl("option", { value: option.value, text: option.label });
  }
}

function currentTaskSendTargetOptions(plugin: TaskHubPlugin, t: Translator) {
  const localAppleSupported = typeof plugin.isLocalAppleSupported === "function" ? plugin.isLocalAppleSupported() : true;
  const allowAppleReminderCreate = typeof plugin.canCreateAppleReminders === "function"
    ? plugin.canCreateAppleReminders()
    : localAppleSupported && plugin.settings.localApple.enabled && plugin.settings.localApple.remindersCreateEnabled;
  const allowDidaCreate = typeof plugin.canCreateDidaTasks === "function"
    ? plugin.canCreateDidaTasks()
    : plugin.settings.dida.enabled && plugin.settings.dida.tasksCreateEnabled && Boolean(plugin.settings.dida.apiToken.trim());
  const appleReminderLists = typeof plugin.getAppleReminderLists === "function"
    ? plugin.getAppleReminderLists()
    : plugin.settings.localApple.remindersLists;
  const didaProjects = typeof plugin.getDidaProjects === "function"
    ? plugin.getDidaProjects()
    : plugin.settings.dida.projects;
  return taskSendTargetOptions({
    allowAppleReminderCreate,
    allowDidaCreate,
    appleReminderLists,
    didaProjects
  }, {
    appleReminders: t("localAppleReminders"),
    appleRemindersInbox: t("localAppleRemindersDefaultListInbox"),
    dida: t("dida"),
    didaInbox: t("didaDefaultProjectInbox")
  });
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

function populateDidaProjectDropdown(selectEl: HTMLSelectElement, plugin: TaskHubPlugin, t: Translator): void {
  selectEl.empty();
  for (const project of plugin.getDidaProjects()) {
    selectEl.createEl("option", { value: project.id, text: project.name });
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

function didaProjectName(projectId: string | undefined, plugin: TaskHubPlugin): string | undefined {
  if (!projectId) return undefined;
  return plugin.getDidaProjects().find((project) => project.id === projectId)?.name;
}

function createCalendarSourceStatusText(status: CalendarSourceStatus, t: Translator): string {
  if (status.state === "ok") return `${t("synced")}, ${status.eventCount} ${t("tasks")}, ${status.lastSyncedAt}`;
  if (status.state === "error") return `${t("failedSync")}: ${status.message}`;
  return t("neverSynced");
}
