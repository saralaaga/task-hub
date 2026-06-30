import type { Language } from "./i18n";
import type { DateBucket } from "./calendar/dateBuckets";
import type { TaskNoteSettings } from "./taskNotes";
import type { RecurrenceEditScope } from "./recurrence";

export type TaskStatusFilter = "open" | "completed" | "all";
export type DefaultView = "tasks" | "calendar" | "tags";
export type WeekStart = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type TaskSource = "vault" | "apple-reminders" | "dida";
export type CalendarTimeScale = "fit" | "hour" | "half" | "quarter";
export type ExternalTaskSourceTab = "apple-calendar" | "apple-reminders" | "dida";

export type TaskItem = {
  id: string;
  stableId?: string;
  filePath: string;
  line: number;
  rawLine: string;
  text: string;
  completed: boolean;
  tags: string[];
  indent?: number;
  parentId?: string;
  dueDate?: string;
  heading?: string;
  contextPreview?: string;
  source: TaskSource;
  externalId?: string;
  externalSourceName?: string;
  externalUrl?: string;
  scheduledDate?: string;
  startDate?: string;
  priority?: string;
  recurrence?: string;
  createdDate?: string;
  completedDate?: string;
  externalListId?: string;
  alertMinutesBefore?: number;
};

export type TaskConditionFilterSettings = {
  operator: "and" | "or";
  tag: string;
  dateBucket: "" | DateBucket;
  text: string;
};

export type TaskViewFilterSettings = {
  status: TaskStatusFilter;
  dateBucket?: DateBucket;
  tags: string[];
  conditions?: TaskConditionFilterSettings;
  tagQuery?: string;
  sourceQuery: string;
  textQuery: string;
};

export type TaskHubSmartList = {
  id: string;
  name: string;
  color?: string;
  filters: TaskViewFilterSettings;
  taskStableIds: string[];
  taskIds: string[];
  excludedTaskStableIds?: string[];
  excludedTaskIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type TaskHubLastSessionState = {
  view: DefaultView;
  taskViewFilters: TaskViewFilterSettings;
  calendarMode: "day" | "week" | "month";
  calendarFocusDate?: string;
  visibleSourceIds: string[];
  unscheduledPanelOpen: boolean;
};

export type CalendarEvent = {
  id: string;
  sourceId: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  calendarId?: string;
  calendarName?: string;
  calendarColor?: string;
  location?: string;
  description?: string;
  url?: string;
  recurrence?: string;
};

export type CalendarItemEditDraft =
  | {
      kind: "task";
      title: string;
      date?: string;
      startTime?: string;
      tags?: string[];
      reminderListId?: string;
      notes?: string;
      alertMinutesBefore?: number | null;
      recurrence?: string | null;
    }
  | {
      kind: "event";
      title: string;
      date: string;
      startTime?: string;
      endTime?: string;
      allDay: boolean;
      calendarId?: string;
      notes?: string;
      location?: string;
      recurrence?: string | null;
      recurrenceScope?: RecurrenceEditScope;
    };

export type CalendarSourceStatus =
  | { state: "ok"; lastSyncedAt: string; eventCount: number }
  | {
      state: "error";
      errorType: "network_error" | "http_error" | "invalid_content" | "parse_error" | "local_error";
      message: string;
      statusCode?: number;
      lastAttemptAt: string;
      lastSuccessfulSyncAt?: string;
    }
  | { state: "never" };

export type CalendarSource = {
  id: string;
  name: string;
  type: "ics" | "apple-calendar" | "apple-reminders" | "dida";
  url: string;
  color: string;
  enabled: boolean;
  refreshIntervalMinutes: number;
  status: CalendarSourceStatus;
  cachedEvents?: CalendarEvent[];
};

export type AppleReminderList = {
  id: string;
  name: string;
  sourceId?: string;
  sourceName?: string;
};

export type DidaProject = {
  id: string;
  name: string;
};

export type AppleCalendarInfo = {
  id: string;
  name: string;
  color?: string;
  writable?: boolean;
};

export type CalendarCreationKind = "task" | "event";

export type CalendarTaskCreationTarget =
  | { type: "vault" }
  | { type: "apple-reminders"; listId?: string }
  | { type: "dida"; projectId?: string };

export type TaskSendTarget =
  | { type: "apple-reminders"; listId?: string }
  | { type: "dida"; projectId?: string };

export type CalendarEventCreationTarget =
  | { type: "apple-calendar"; calendarId?: string };

export type CalendarCreationTarget = CalendarTaskCreationTarget | CalendarEventCreationTarget;

export type LocalAppleIntegrationSettings = {
  enabled: boolean;
  remindersEnabled: boolean;
  remindersColor: string;
  reminderColorOverrides: Record<string, string>;
  remindersWritebackEnabled: boolean;
  remindersCreateEnabled: boolean;
  remindersCreateTagsEnabled: boolean;
  remindersDefaultListId?: string;
  reminderDurationOverrides: Record<string, number>;
  remindersLists: AppleReminderList[];
  calendarEnabled: boolean;
  calendarColor: string;
  calendarColorOverrides: Record<string, string>;
  calendars: AppleCalendarInfo[];
  calendarWritebackEnabled: boolean;
  calendarTaskSendEnabled: boolean;
  calendarReminderConversionEnabled: boolean;
  calendarDefaultTimedTaskDurationMinutes: number;
  calendarLookbackDays: number;
  calendarLookaheadDays: number;
};

export type LocalAppleSyncStatus =
  | { state: "ok"; lastSyncedAt: string; itemCount: number; reminders: CalendarSourceStatus; calendar: CalendarSourceStatus }
  | { state: "error"; lastAttemptAt: string; message: string; reminders: CalendarSourceStatus; calendar: CalendarSourceStatus }
  | { state: "never"; reminders?: CalendarSourceStatus; calendar?: CalendarSourceStatus };

export type DidaIntegrationSettings = {
  enabled: boolean;
  tasksEnabled: boolean;
  tasksColor: string;
  taskColorOverrides: Record<string, string>;
  tasksWritebackEnabled: boolean;
  tasksCreateEnabled: boolean;
  tasksDragRescheduleEnabled: boolean;
  tasksDeleteEnabled: boolean;
  tasksCreateTagsEnabled: boolean;
  defaultProjectId?: string;
  projects: DidaProject[];
  apiBase: string;
  apiToken: string;
  syncStatus: CalendarSourceStatus;
  defaultReminderOffsetMinutes?: number;
};

export type IndexedFileState = {
  path: string;
  ctime: number;
  mtime: number;
  size: number;
  taskIds: string[];
  lastIndexedAt: string;
  lastError?: string;
};

export type TaskListManualOrder = Record<string, string[]>;
export type TaskNoteManualOrder = Record<string, string[]>;
export type TaskNotePinned = Record<string, string[]>;

export type PersistedVaultTaskStableRecord = {
  stableId: string;
  currentId: string;
  text: string;
  line: number;
  heading?: string;
  indent?: number;
  dueDate?: string;
  scheduledDate?: string;
  startDate?: string;
  tags: string[];
  completed: boolean;
};

export type ExternalTaskShadowMetadata = {
  startDate?: string;
  lastSeenAt?: string;
};

export type TaskHubSettings = {
  settingsSchemaVersion: number;
  language: Language;
  defaultView: DefaultView;
  lastSessionState?: TaskHubLastSessionState;
  weekStart: WeekStart;
  showCompletedByDefault: boolean;
  showSubtaskProgressBars: boolean;
  showLunarCalendar: boolean;
  indexOnStartup: boolean;
  calendarTaskCreationEnabled: boolean;
  calendarCreationDefaultKind: CalendarCreationKind;
  calendarTaskCreationDefaultTarget: CalendarTaskCreationTarget;
  calendarEventCreationDefaultTarget: CalendarEventCreationTarget;
  taskSendDefaultTarget?: TaskSendTarget;
  calendarTimeScale: CalendarTimeScale;
  calendarDayStartHour: number;
  calendarDayEndHour: number;
  taskCreationFilePath: string;
  taskNotes: TaskNoteSettings;
  taskViewFilters: TaskViewFilterSettings;
  taskListManualOrder: TaskListManualOrder;
  taskNoteManualOrder: TaskNoteManualOrder;
  taskNotePinned: TaskNotePinned;
  smartLists: TaskHubSmartList[];
  vaultTaskStableState: Record<string, PersistedVaultTaskStableRecord[]>;
  externalTaskLookbackDays: number;
  externalTaskLookaheadDays: number;
  externalTaskMetadata: Record<string, ExternalTaskShadowMetadata>;
  ignoredPaths: string[];
  tagViewOrder: string[];
  calendarSources: CalendarSource[];
  externalTaskSourceOrder: ExternalTaskSourceTab[];
  localApple: LocalAppleIntegrationSettings;
  dida: DidaIntegrationSettings;
  appleReminderLinks: Record<string, string>;
  didaTaskLinks: Record<string, string>;
};
