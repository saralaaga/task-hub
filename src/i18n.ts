export type Language = "en" | "zh";

export type TranslationKey =
  | "add"
  | "addIcsSource"
  | "addIcsSourceDesc"
  | "all"
  | "allDay"
  | "and"
  | "anyDate"
  | "applyFilters"
  | "appleReminderAlreadySent"
  | "appleCalendarCreateDisabled"
  | "appleCalendarEventCreated"
  | "appleCalendarReminderConversionDisabled"
  | "appleCalendarReminderConversionPartial"
  | "appleCalendarReminderConverted"
  | "appleCalendarReminderConversionRiskConfirm"
  | "appleCalendarReminderConversionRiskTitle"
  | "appleReminderCreateDisabled"
  | "appleReminderCreateVaultOnly"
  | "appleReminderCreated"
  | "appleReminderCreatedAndTaskRemoved"
  | "appleReminderList"
  | "appleReminderListUpdated"
  | "appleReminderNoTaskAtCursor"
  | "calendar"
  | "calendarEmpty"
  | "calendarItemDeleted"
  | "calendarCreationDefaultKind"
  | "calendarCreationDefaultKindDesc"
  | "calendarCreationKind"
  | "calendarTaskCreation"
  | "calendarTaskCreationDesc"
  | "calendarDetails"
  | "calendarDayEndHour"
  | "calendarDayEndHourDesc"
  | "calendarDayStartHour"
  | "calendarDayStartHourDesc"
  | "changed"
  | "clearFilters"
  | "cancel"
  | "completed"
  | "context"
  | "conditionDate"
  | "conditionMatch"
  | "conditionTag"
  | "conditionText"
  | "createTaskNote"
  | "day"
  | "defaultView"
  | "defaultViewDesc"
  | "delete"
  | "deleteFromAppleCalendar"
  | "deleteFromAppleReminders"
  | "deleteFromDida"
  | "deleteCalendarItem"
  | "dida"
  | "didaApiBase"
  | "didaApiBaseDesc"
  | "didaApiBaseDida"
  | "didaApiBaseTickTick"
  | "didaApiToken"
  | "didaApiTokenDesc"
  | "didaCreate"
  | "didaCreateDesc"
  | "didaCreateDisabled"
  | "didaCreateTags"
  | "didaCreateTagsDesc"
  | "didaDefaultProject"
  | "didaDefaultProjectDesc"
  | "didaDefaultProjectInbox"
  | "didaDefaultReminder"
  | "didaDefaultReminderDesc"
  | "didaDelete"
  | "didaDeleteDesc"
  | "didaDesc"
  | "didaDisabledDesc"
  | "didaDragReschedule"
  | "didaDragRescheduleDesc"
  | "didaEnable"
  | "didaProject"
  | "didaProjectColorNoProjects"
  | "didaProjectColors"
  | "didaProjectColorsDesc"
  | "didaTaskCreated"
  | "didaTaskCreatedAndTaskRemoved"
  | "didaTasks"
  | "didaTasksColor"
  | "didaTasksColorDesc"
  | "didaTasksDesc"
  | "didaTestConnection"
  | "didaVaultOnly"
  | "didaWriteback"
  | "didaWritebackDesc"
  | "edit"
  | "editDetails"
  | "event"
  | "eventCreationDefaultTarget"
  | "eventCreationDefaultTargetDesc"
  | "eventCreationDuration"
  | "eventCreationDurationDays"
  | "eventCreationDurationDesc"
  | "eventCreationDurationHours"
  | "eventCreationDurationMinutes"
  | "eventCreationPlaceholder"
  | "eventCreationTitle"
  | "eventUpdated"
  | "events"
  | "externalTaskReadOnly"
  | "externalSourceOpenUnavailable"
  | "externalCalendars"
  | "externalTaskSources"
  | "externalTaskSourcesDesc"
  | "externalTaskSourcesEmpty"
  | "feedbackButton"
  | "feedbackDesc"
  | "feedbackTitle"
  | "failedSync"
  | "failed"
  | "fileNotFound"
  | "filters"
  | "future"
  | "httpError"
  | "ignoredPaths"
  | "ignoredPathsDesc"
  | "invalidContent"
  | "indexOnStartup"
  | "indexOnStartupDesc"
  | "language"
  | "languageDesc"
  | "lastScan"
  | "layers"
  | "linePositionUnavailable"
  | "lineChangedConflict"
  | "lineMismatchConflict"
  | "lineNoLongerOpen"
  | "lineOutsideFile"
  | "localApple"
  | "localAppleError"
  | "localAppleCalendar"
  | "localAppleCalendarColor"
  | "localAppleCalendarColorDesc"
  | "localAppleCalendarColorNoCalendars"
  | "localAppleCalendarColors"
  | "localAppleCalendarColorsDesc"
  | "localAppleCalendarSystemColor"
  | "localAppleCalendarDesc"
  | "localAppleCalendarReminderConversion"
  | "localAppleCalendarReminderConversionDesc"
  | "localAppleCalendarTaskSend"
  | "localAppleCalendarTaskSendDesc"
  | "localAppleCalendarDefaultTimedTaskDuration"
  | "localAppleCalendarDefaultTimedTaskDurationDesc"
  | "localAppleCalendarWriteback"
  | "localAppleCalendarWritebackDesc"
  | "localAppleDesc"
  | "localAppleDisabledDesc"
  | "localAppleCheckStatus"
  | "localAppleHelperMissing"
  | "localAppleHelperMissingDesc"
  | "localAppleLookahead"
  | "localAppleLookback"
  | "localApplePermissionAuthorized"
  | "localApplePermissionDenied"
  | "localApplePermissionNotDetermined"
  | "localApplePermissionRestricted"
  | "localAppleCalendarPermissionBlocked"
  | "localAppleReminders"
  | "localAppleRemindersColor"
  | "localAppleRemindersColorDesc"
  | "localAppleReminderColorNoLists"
  | "localAppleReminderListColors"
  | "localAppleReminderListColorsDesc"
  | "localAppleRemindersDisabledDesc"
  | "localAppleRemindersDesc"
  | "localAppleRemindersCreate"
  | "localAppleRemindersCreateDesc"
  | "localAppleRemindersCreateTags"
  | "localAppleRemindersCreateTagsDesc"
  | "localAppleRemindersCreateRiskConfirm"
  | "localAppleRemindersCreateRiskEnable"
  | "localAppleRemindersCreateRiskTitle"
  | "localAppleRemindersDefaultList"
  | "localAppleRemindersDefaultListDesc"
  | "localAppleRemindersDefaultListInbox"
  | "localAppleRemindersPermissionBlocked"
  | "localAppleRemindersPermissionPending"
  | "localAppleRemindersWriteback"
  | "localAppleRemindersWritebackDesc"
  | "localAppleRequestAccess"
  | "localAppleNoEnabledTabs"
  | "localAppleUnsupportedPlatform"
  | "monday"
  | "month"
  | "more"
  | "markComplete"
  | "markOpen"
  | "name"
  | "neverSynced"
  | "networkError"
  | "next"
  | "notes"
  | "noMatchingTasks"
  | "noOpenTasks"
  | "noTags"
  | "noDate"
  | "noUnscheduledTasks"
  | "notSynced"
  | "open"
  | "openSource"
  | "openTaskHub"
  | "opened"
  | "or"
  | "otherCompleted"
  | "overdue"
  | "parseError"
  | "previous"
  | "rescan"
  | "rescanComplete"
  | "rescanFailed"
  | "rescanning"
  | "rescanTaskHub"
  | "remove"
  | "recurrence"
  | "recurrenceApplyTo"
  | "recurrenceCustom"
  | "recurrenceDaily"
  | "recurrenceEndDate"
  | "recurrenceEndDateRequired"
  | "recurrenceFuture"
  | "recurrenceMonthly"
  | "recurrenceNone"
  | "recurrenceStartDate"
  | "recurrenceThis"
  | "recurrenceWeekly"
  | "recurrenceYearly"
  | "reminderAlert"
  | "reminderAlertAtTime"
  | "reminderAlertMinutesBefore"
  | "reminderAlertOneDayBefore"
  | "reminderAlertOneHourBefore"
  | "reminderAlertOneWeekBefore"
  | "reminderAlertTwoDaysBefore"
  | "search"
  | "searchTags"
  | "searchTasks"
  | "settingsTitle"
  | "friday"
  | "sendCurrentTaskToAppleReminders"
  | "sendTo"
  | "sendToAppleCalendar"
  | "sendToAppleReminders"
  | "sendToAppleRemindersDisabled"
  | "sendToDida"
  | "sendToNoTargets"
  | "sendToTarget"
  | "showCompletedByDefault"
  | "showCompletedByDefaultDesc"
  | "showCompletedInView"
  | "showLunarCalendar"
  | "showLunarCalendarDesc"
  | "skipped"
  | "sourceSearch"
  | "sourceAppleCalendar"
  | "sourceAppleReminders"
  | "sourceDida"
  | "sourceVaultTask"
  | "source"
  | "save"
  | "startTime"
  | "endTime"
  | "date"
  | "readOnly"
  | "supportedTaskSyntax"
  | "supportedTaskSyntaxDesc"
  | "sync"
  | "synced"
  | "tags"
  | "task"
  | "taskAlreadyCompleted"
  | "taskCompleted"
  | "taskCreated"
  | "taskDateAlreadySet"
  | "taskDateTokenMissing"
  | "taskDateUpdated"
  | "taskUpdated"
  | "taskCreationFile"
  | "taskCreationFileDesc"
  | "taskCreationDefaultTarget"
  | "taskCreationDefaultTargetDesc"
  | "taskCreationBody"
  | "taskCreationTitle"
  | "taskCreationPlaceholder"
  | "taskCreationTime"
  | "taskCreationTarget"
  | "taskDetails"
  | "taskHub"
  | "taskSendDefaultTarget"
  | "taskSendDefaultTargetDesc"
  | "taskNoteCreated"
  | "taskNotesDefaultMode"
  | "taskNotesDefaultModeDesc"
  | "taskNotesDisabled"
  | "taskNotesEnable"
  | "taskNotesEnableDesc"
  | "taskNotesFolder"
  | "taskNotesFolderDesc"
  | "taskNotesOpenAfterCreate"
  | "taskNotesOpenAfterCreateDesc"
  | "taskNotesSection"
  | "taskNotesShowCounts"
  | "taskNotesShowCountsDesc"
  | "taskNotesShowFrontmatter"
  | "taskNotesShowFrontmatterDesc"
  | "taskNotesThino"
  | "taskNotesThinoDesc"
  | "taskNotesThinoFolder"
  | "taskNotesThinoFolderDesc"
  | "taskNoteEditInThino"
  | "taskNoteDeleted"
  | "taskNoteSave"
  | "taskNoteSaved"
  | "taskReopened"
  | "taskUpdateFailed"
  | "tasks"
  | "tasksIndexed"
  | "thisWeek"
  | "today"
  | "tomorrow"
  | "tuesday"
  | "thursday"
  | "sunday"
  | "saturday"
  | "unscheduled"
  | "unscheduledTasks"
  | "vaultTasks"
  | "week"
  | "weekStartsOn"
  | "weekStartsOnDesc"
  | "wednesday";

const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  en: {
    add: "Add",
    addIcsSource: "Add ICS source",
    addIcsSourceDesc: "Add a public read-only .ics URL.",
    all: "All",
    allDay: "All day",
    and: "AND",
    anyDate: "Any date",
    applyFilters: "Filter",
    appleReminderAlreadySent: "This task was already sent to Apple Reminders",
    appleCalendarCreateDisabled: "Turn on Local Apple, Apple Calendar, and task sending in Task Hub settings first.",
    appleCalendarEventCreated: "Apple Calendar event created.",
    appleCalendarReminderConversionDisabled: "Turn on Local Apple, Apple Calendar, Apple Reminders, and conversion in Task Hub settings first.",
    appleCalendarReminderConversionPartial: "The target item was created, but Task Hub could not delete the source item.",
    appleCalendarReminderConverted: "Converted Apple Calendar and Reminders item.",
    appleCalendarReminderConversionRiskConfirm:
      "This feature moves items between Apple Calendar and Apple Reminders. Task Hub creates the target item first, then deletes the source Apple item. If the delete step fails, you may need to remove a duplicate manually.",
    appleCalendarReminderConversionRiskTitle: "Confirm Apple item conversion",
    appleReminderCreateDisabled: "Turn on Local Apple, Apple Reminders, and reminder creation in Task Hub settings first.",
    appleReminderCreateVaultOnly: "Only vault Markdown tasks can be sent to Apple Reminders.",
    appleReminderCreated: "Apple Reminder created.",
    appleReminderCreatedAndTaskRemoved: "Apple Reminder created and source task removed.",
    appleReminderList: "Apple Reminders list",
    appleReminderListUpdated: "Apple Reminders list updated.",
    appleReminderNoTaskAtCursor: "Place the cursor on a Markdown task first.",
    calendar: "Calendar",
    calendarEmpty: "No tasks or events in this calendar range.",
    calendarItemDeleted: "Calendar item deleted.",
    calendarCreationDefaultKind: "Default creation type",
    calendarCreationDefaultKindDesc: "Default type selected when you create from the calendar.",
    calendarCreationKind: "Create",
    calendarTaskCreation: "Create from calendar",
    calendarTaskCreationDesc: "Click empty calendar space to create a task or an Apple Calendar event.",
    calendarDetails: "Calendar details",
    calendarDayEndHour: "Day/week end time",
    calendarDayEndHourDesc: "Latest hour shown by default in day and week views. Later items still extend the range.",
    calendarDayStartHour: "Day/week start time",
    calendarDayStartHourDesc: "Earliest hour shown by default in day and week views. Earlier items still extend the range.",
    changed: "changed",
    clearFilters: "Clear",
    cancel: "Cancel",
    completed: "Completed",
    context: "Context",
    conditionDate: "Time",
    conditionMatch: "Match",
    conditionTag: "Tag",
    conditionText: "Text",
    createTaskNote: "Create linked note",
    day: "Day",
    defaultView: "Default view",
    defaultViewDesc: "View shown when Task Hub opens.",
    delete: "Delete",
    deleteCalendarItem: "Delete from calendar",
    deleteFromAppleCalendar: "Delete from Apple Calendar",
    deleteFromAppleReminders: "Delete from Apple Reminders",
    deleteFromDida: "Delete from Dida",
    dida: "Dida",
    didaApiBase: "API service",
    didaApiBaseDesc: "Choose Dida for China or TickTick for the international service.",
    didaApiBaseDida: "Dida (China)",
    didaApiBaseTickTick: "TickTick (International)",
    didaApiToken: "API token",
    didaApiTokenDesc: "Stored in Obsidian plugin data. Use a test account or rotate this token after development.",
    didaCreate: "Create Dida tasks",
    didaCreateDesc: "Allow Task Hub to create Dida tasks and send vault tasks to Dida.",
    didaCreateDisabled: "Turn on Dida, Dida tasks, and Dida task creation in Task Hub settings first.",
    didaCreateTags: "Sync native Dida tags",
    didaCreateTagsDesc: "Write Task Hub tags to Dida native task tags when creating or editing Dida tasks.",
    didaDefaultProject: "Default Dida list",
    didaDefaultProjectDesc: "Default list used when creating Dida tasks.",
    didaDefaultProjectInbox: "Default Dida inbox",
    didaDefaultReminder: "Default reminder offset",
    didaDefaultReminderDesc: "Minutes before the due time. Use 0 for due-time reminders.",
    didaDelete: "Delete Dida tasks",
    didaDeleteDesc: "Allow Task Hub to delete Dida tasks from the external source.",
    didaDesc: "Sync and write Dida/TickTick tasks through the Open API.",
    didaDisabledDesc: "Dida sync is off.",
    didaDragReschedule: "Drag Dida tasks",
    didaDragRescheduleDesc: "Allow dragging Dida tasks in the calendar to change date or time.",
    didaEnable: "Dida integration",
    didaProject: "Dida list",
    didaProjectColorNoProjects: "Sync Dida once to load list colors.",
    didaProjectColors: "Dida list colors",
    didaProjectColorsDesc: "Override the display color for each Dida list.",
    didaTaskCreated: "Dida task created.",
    didaTaskCreatedAndTaskRemoved: "Dida task created and source task removed.",
    didaTasks: "Dida tasks",
    didaTasksColor: "Dida task color",
    didaTasksColorDesc: "Fallback color for Dida tasks.",
    didaTasksDesc: "Read Dida tasks into Task Hub.",
    didaTestConnection: "Test / sync",
    didaVaultOnly: "Only vault Markdown tasks can be sent to Dida.",
    didaWriteback: "Edit and complete Dida tasks",
    didaWritebackDesc: "Allow Task Hub to update Dida titles, notes, list, dates, times, and completion state.",
    edit: "Edit",
    editDetails: "Edit details",
    event: "Event",
    eventCreationDefaultTarget: "Default event destination",
    eventCreationDefaultTargetDesc: "Default Apple Calendar selected when you create an event from the calendar.",
    eventCreationDuration: "Duration",
    eventCreationDurationDays: "Days",
    eventCreationDurationDesc: "Event length. All-day events use days; timed events use hours and minutes.",
    eventCreationDurationHours: "Hours",
    eventCreationDurationMinutes: "Minutes",
    eventCreationPlaceholder: "Event title",
    eventCreationTitle: "Create event",
    eventUpdated: "Event updated.",
    events: "events",
    externalTaskReadOnly: "External items are read-only unless the matching Apple writeback option is enabled.",
    externalSourceOpenUnavailable: "Task Hub could not open this external source.",
    externalCalendars: "External calendars",
    externalTaskSources: "External task sources",
    externalTaskSourcesDesc: "Enable Apple Calendar, Apple Reminders, and Dida/TickTick; drag the tabs to choose their default order.",
    externalTaskSourcesEmpty: "Enable an external task source above to configure it.",
    feedbackButton: "Report bug / suggest",
    feedbackDesc: "Open the GitHub issue page to report bugs, share ideas, or leave feedback.",
    feedbackTitle: "Feedback",
    failed: "failed",
    failedSync: "Failed to sync",
    fileNotFound: "File not found",
    filters: "Filters",
    future: "Future",
    httpError: "HTTP error",
    ignoredPaths: "Ignored paths",
    ignoredPathsDesc: "Comma-separated folder or file prefixes.",
    invalidContent: "Invalid content",
    indexOnStartup: "Index on startup",
    indexOnStartupDesc: "Scan changed Markdown files when Obsidian starts.",
    language: "Language",
    languageDesc: "Choose the UI language for Task Hub.",
    lastScan: "Last scan",
    layers: "Layers",
    linePositionUnavailable: "line positioning was not available.",
    lineChangedConflict: "The task line changed and Task Hub could not safely identify the original task.",
    lineMismatchConflict: "The indexed task line no longer matches the file.",
    lineNoLongerOpen: "The indexed line is no longer an open task.",
    lineOutsideFile: "The indexed task line is outside the file.",
    localApple: "Local Apple",
    localAppleError: "Local Apple error",
    localAppleCalendar: "Apple Calendar",
    localAppleCalendarColor: "Apple Calendar color",
    localAppleCalendarColorDesc: "Preview the current calendar color or pick a softer recommended color.",
    localAppleCalendarColorNoCalendars: "Sync Apple Calendar once to configure colors for individual calendars.",
    localAppleCalendarColors: "Apple calendar colors",
    localAppleCalendarColorsDesc: "Override the display color for each local Apple calendar. Leave the system color in place when it looks right.",
    localAppleCalendarSystemColor: "System color",
    localAppleCalendarDesc: "Read local Apple Calendar events into the Task Hub calendar. macOS may ask for permission.",
    localAppleCalendarReminderConversion: "Convert Apple Calendar and Reminders",
    localAppleCalendarReminderConversionDesc:
      "Add right-click actions to move Apple Calendar events to Apple Reminders and Apple Reminders to Apple Calendar. Task Hub creates the target item first, then deletes the source item.",
    localAppleCalendarTaskSend: "Send tasks to Apple Calendar",
    localAppleCalendarTaskSendDesc:
      "Allow right-clicking dated vault tasks in the calendar to create all-day Apple Calendar events, then remove the source Markdown task after creation succeeds.",
    localAppleCalendarDefaultTimedTaskDuration: "Default timed task duration",
    localAppleCalendarDefaultTimedTaskDurationDesc:
      "Minutes to use when dragging a vault task onto the day or week time grid. Default is 60.",
    localAppleCalendarWriteback: "Reschedule Apple Calendar events",
    localAppleCalendarWritebackDesc:
      "Allow drag-and-drop date changes for local Apple Calendar events. Task Hub preserves each event's time, duration, and all-day status.",
    localAppleCheckStatus: "Check status",
    localAppleDesc:
      "Local Apple integrations read local Reminders and Calendar on macOS. Task Hub only writes Apple Reminders completion status and Apple Calendar event dates when you turn those options on.",
    localAppleDisabledDesc: "Turn on Local Apple to configure local Calendar and Reminders reading.",
    localAppleHelperMissing: "Apple helper missing",
    localAppleHelperMissingDesc: "Install a Task Hub release that includes taskhub-apple-helper.",
    localAppleLookahead: "Calendar lookahead days",
    localAppleLookback: "Calendar lookback days",
    localApplePermissionAuthorized: "Permission granted.",
    localApplePermissionDenied: "Permission denied in macOS Privacy & Security settings.",
    localApplePermissionNotDetermined: "Permission has not been requested.",
    localApplePermissionRestricted: "Permission is restricted on this Mac.",
    localAppleCalendarPermissionBlocked:
      "Apple Calendar permission is blocked. Open macOS System Settings > Privacy & Security > Calendars, allow Obsidian or Task Hub Apple Helper, then try again.",
    localAppleReminders: "Apple Reminders",
    localAppleRemindersColor: "Apple Reminders color",
    localAppleRemindersColorDesc: "Preview the current color or pick a softer recommended color.",
    localAppleReminderColorNoLists: "Sync Apple Reminders once to configure colors for individual lists.",
    localAppleReminderListColors: "Apple Reminders list colors",
    localAppleReminderListColorsDesc: "Override the display color for each local Apple Reminders list.",
    localAppleRemindersDisabledDesc: "Turn on Apple Reminders to configure local reading, completion writeback, and display color.",
    localAppleRemindersDesc: "Read local Apple Reminders into the task list and dated reminders into the calendar.",
    localAppleRemindersCreate: "Create Apple Reminders from vault tasks",
    localAppleRemindersCreateDesc:
      "Allow Task Hub to create Apple Reminders from vault tasks, then remove the source Markdown task after creation succeeds.",
    localAppleRemindersCreateTags: "Send source tags to Apple Reminders",
    localAppleRemindersCreateTagsDesc:
      "When a vault task has tags, append them as Apple Reminders hashtags in the new reminder title. Nested tags use hyphens.",
    localAppleRemindersCreateRiskConfirm:
      "This feature changes your vault's original Markdown data. After Task Hub creates an Apple Reminder, it will delete the source task line from your note. If sync or indexing is stale, you may need to resolve duplicates or conflicts manually. Confirm only after backing up or trusting this workflow.",
    localAppleRemindersCreateRiskEnable: "Confirm and enable",
    localAppleRemindersCreateRiskTitle: "Confirm source task deletion",
    localAppleRemindersDefaultList: "Default Reminders list",
    localAppleRemindersDefaultListDesc: "Default list for new Apple Reminders created from Task Hub.",
    localAppleRemindersDefaultListInbox: "Default Reminders list",
    localAppleRemindersPermissionBlocked:
      "Apple Reminders permission is blocked. Open macOS System Settings > Privacy & Security > Reminders, allow Obsidian or Task Hub Apple Helper, then try again.",
    localAppleRemindersPermissionPending:
      "Apple Reminders permission is still pending. Open Task Hub settings > Local Apple, click Request access, then approve Reminders permission in macOS.",
    localAppleRemindersWriteback: "Write completion status to Apple Reminders",
    localAppleRemindersWritebackDesc:
      "Allow Task Hub to complete, reopen, reschedule, and edit local Apple Reminders from supported Task Hub controls.",
    localAppleRequestAccess: "Request access",
    localAppleNoEnabledTabs: "Turn on Apple Calendar or Apple Reminders to configure that integration.",
    localAppleUnsupportedPlatform:
      "This feature is only supported on macOS. Apple Calendar and Reminders require local macOS system access, so Task Hub cannot enable them on this system.",
    monday: "Monday",
    month: "Month",
    more: "more",
    markComplete: "Mark complete",
    markOpen: "Mark open",
    name: "Name",
    neverSynced: "Never synced",
    networkError: "Network error",
    next: "Next",
    notes: "Notes",
    noMatchingTasks: "No tasks match the current filters.",
    noOpenTasks: "No open tasks found in the indexed vault.",
    noTags: "No tags found in indexed tasks.",
    noDate: "No date",
    noUnscheduledTasks: "No unscheduled tasks.",
    notSynced: "not synced",
    open: "Open",
    openSource: "Open source",
    openTaskHub: "Open Task Hub",
    opened: "Opened",
    or: "OR",
    otherCompleted: "Other completed",
    overdue: "Overdue",
    parseError: "Parse error",
    previous: "Prev",
    rescan: "Rescan",
    rescanComplete: "Task Hub refreshed.",
    rescanFailed: "Task Hub refresh failed",
    rescanning: "Rescanning...",
    rescanTaskHub: "Rescan Task Hub",
    remove: "Remove",
    recurrence: "Repeat",
    recurrenceApplyTo: "Apply to",
    recurrenceCustom: "Custom repeat",
    recurrenceDaily: "Every day",
    recurrenceEndDate: "Repeat until",
    recurrenceEndDateRequired: "Choose repeat start and end dates for recurring events.",
    recurrenceFuture: "This and future events",
    recurrenceMonthly: "Every month",
    recurrenceNone: "Does not repeat",
    recurrenceStartDate: "Repeat from",
    recurrenceThis: "This event only",
    recurrenceWeekly: "Every week",
    recurrenceYearly: "Every year",
    reminderAlert: "Reminder",
    reminderAlertAtTime: "At time",
    reminderAlertMinutesBefore: "{minutes} minutes before",
    reminderAlertOneDayBefore: "1 day before",
    reminderAlertOneHourBefore: "1 hour before",
    reminderAlertOneWeekBefore: "1 week before",
    reminderAlertTwoDaysBefore: "2 days before",
    readOnly: "Read-only",
    date: "Date",
    endTime: "End time",
    save: "Save",
    search: "Search",
    searchTags: "Search tags",
    searchTasks: "Search tasks",
    settingsTitle: "Task Hub Settings",
    friday: "Friday",
    sendCurrentTaskToAppleReminders: "Send current task to Apple Reminders",
    sendTo: "Send to",
    sendToAppleCalendar: "Convert to Apple Calendar",
    sendToAppleReminders: "Send to Apple Reminders",
    sendToAppleRemindersDisabled: "Enable Apple Reminders creation in settings first",
    sendToDida: "Send to Dida",
    sendToNoTargets: "Turn on Apple Reminders or Dida creation in Task Hub settings first.",
    sendToTarget: "Send destination",
    sourceAppleCalendar: "Apple Calendar",
    sourceAppleReminders: "Apple Reminders",
    sourceDida: "Dida",
    sourceVaultTask: "Vault task",
    showCompletedByDefault: "Show completed tasks by default",
    showCompletedByDefaultDesc: "Completed tasks remain indexed but hidden unless this is enabled.",
    showCompletedInView: "Show completed",
    showLunarCalendar: "Show lunar dates",
    showLunarCalendarDesc: "Display Chinese lunar dates in the month calendar when the interface language is Chinese.",
    skipped: "skipped",
    sourceSearch: "Folder or file",
    source: "Source",
    startTime: "Start time",
    supportedTaskSyntax: "Supported task syntax",
    supportedTaskSyntaxDesc: "Version 1 supports - [ ], - [x], Obsidian tags, 📅 YYYY-MM-DD, and due:: YYYY-MM-DD.",
    sync: "Sync",
    synced: "Synced",
    tags: "Tags",
    task: "Task",
    taskAlreadyCompleted: "Task is already completed.",
    taskCompleted: "Task completed.",
    taskCreated: "Task created.",
    taskDateAlreadySet: "Task is already on that date.",
    taskDateTokenMissing: "The task line does not contain a supported due date.",
    taskDateUpdated: "Task date updated.",
    taskUpdated: "Task updated.",
    taskCreationDefaultTarget: "Default task destination",
    taskCreationDefaultTargetDesc: "Default task destination selected when you create a task from the calendar.",
    taskCreationBody: "Body",
    taskCreationFile: "Task creation file",
    taskCreationFileDesc: "New calendar tasks are appended to this Markdown file.",
    taskCreationTitle: "Create task",
    taskCreationPlaceholder: "Task content",
    taskCreationTime: "Time",
    taskCreationTarget: "Create in",
    taskDetails: "Task details",
    taskHub: "Task Hub",
    taskSendDefaultTarget: "Default send destination",
    taskSendDefaultTargetDesc: "Default destination selected beside the Send to button in task details.",
    taskNoteCreated: "Task note created.",
    taskNotesDefaultMode: "Default note format",
    taskNotesDefaultModeDesc: "Create plain Task Hub notes or notes compatible only with Thino multi-file storage.",
    taskNotesDisabled: "Turn on task notes in Task Hub settings first.",
    taskNotesEnable: "Task notes",
    taskNotesEnableDesc: "Create Markdown notes linked to tasks and calendar events.",
    taskNotesFolder: "Task Hub notes folder",
    taskNotesFolderDesc: "Folder for regular Task Hub linked notes.",
    taskNotesOpenAfterCreate: "Open note after creation",
    taskNotesOpenAfterCreateDesc: "Open the created Markdown note in a new tab.",
    taskNotesSection: "Task notes",
    taskNotesShowCounts: "Show note counts",
    taskNotesShowCountsDesc: "Show note counts on task list rows when notes exist.",
    taskNotesShowFrontmatter: "Show note metadata in editor",
    taskNotesShowFrontmatterDesc: "Show YAML/frontmatter properties when opening linked note pop-ups. Off by default so the editor starts at the note body.",
    taskNotesThino: "Create Thino multi-file notes only",
    taskNotesThinoDesc: "Use Thino multi-file frontmatter for newly created notes. Thino single-file, Canvas, and diary storage are not generated.",
    taskNotesThinoFolder: "Thino notes folder",
    taskNotesThinoFolderDesc: "Folder used by Thino multi-file storage.",
    taskNoteEditInThino: "Edit in Thino",
    taskNoteDeleted: "Task note deleted.",
    taskNoteSave: "Save note",
    taskNoteSaved: "Task note saved.",
    taskReopened: "Task reopened.",
    taskUpdateFailed: "Task Hub could not update the task.",
    tasks: "Tasks",
    tasksIndexed: "tasks indexed",
    thisWeek: "This week",
    today: "Today",
    tomorrow: "Tomorrow",
    tuesday: "Tuesday",
    thursday: "Thursday",
    sunday: "Sunday",
    saturday: "Saturday",
    unscheduled: "Unscheduled",
    unscheduledTasks: "Unscheduled tasks",
    vaultTasks: "Vault tasks",
    week: "Week",
    weekStartsOn: "Week starts on",
    weekStartsOnDesc: "Controls week grouping and calendar layout.",
    wednesday: "Wednesday"
  },
  zh: {
    add: "添加",
    addIcsSource: "添加 ICS 日历源",
    addIcsSourceDesc: "添加一个公开、只读的 .ics URL。",
    all: "全部",
    allDay: "全天",
    and: "且",
    anyDate: "任意日期",
    applyFilters: "筛选",
    appleReminderAlreadySent: "这条任务已经发送到 Apple 提醒事项",
    appleCalendarCreateDisabled: "请先在 Task Hub 设置中开启本地 Apple、Apple 日历和发送任务到 Apple 日历。",
    appleCalendarEventCreated: "已创建 Apple 日历事件。",
    appleCalendarReminderConversionDisabled: "请先在 Task Hub 设置中开启本地 Apple、Apple 日历、Apple 提醒事项和互相转换。",
    appleCalendarReminderConversionPartial: "目标项目已经创建，但 Task Hub 未能删除源项目。",
    appleCalendarReminderConverted: "已转换 Apple 日历和提醒事项项目。",
    appleCalendarReminderConversionRiskConfirm:
      "此功能会在 Apple 日历和 Apple 提醒事项之间移动项目。Task Hub 会先创建目标项目，再删除源 Apple 项目。如果删除步骤失败，可能需要你手动清理重复项目。",
    appleCalendarReminderConversionRiskTitle: "确认 Apple 项目转换",
    appleReminderCreateDisabled: "请先在 Task Hub 设置中开启本地 Apple、Apple 提醒事项和创建提醒事项。",
    appleReminderCreateVaultOnly: "只有 vault 中的 Markdown 任务可以发送到 Apple 提醒事项。",
    appleReminderCreated: "已创建 Apple 提醒事项。",
    appleReminderCreatedAndTaskRemoved: "已创建 Apple 提醒事项，并删除源任务。",
    appleReminderList: "Apple 提醒事项列表",
    appleReminderListUpdated: "Apple 提醒事项列表已更新。",
    appleReminderNoTaskAtCursor: "请先把光标放在一条 Markdown 任务上。",
    calendar: "日历",
    calendarEmpty: "当前日历范围内没有任务或事件。",
    calendarItemDeleted: "日历项目已删除。",
    calendarCreationDefaultKind: "默认创建类型",
    calendarCreationDefaultKindDesc: "从日历新建时默认选中的类型。",
    calendarCreationKind: "创建",
    calendarTaskCreation: "允许从日历创建",
    calendarTaskCreationDesc: "点击日历空白区域创建任务或 Apple 日历事件。",
    calendarDetails: "日历详情",
    calendarDayEndHour: "日/周视图结束时间",
    calendarDayEndHourDesc: "日视图和周视图默认显示到几点；更晚的项目会自动扩展范围。",
    calendarDayStartHour: "日/周视图开始时间",
    calendarDayStartHourDesc: "日视图和周视图默认从几点开始；更早的项目会自动扩展范围。",
    changed: "已变化",
    clearFilters: "清空",
    cancel: "取消",
    completed: "已完成",
    context: "上下文",
    conditionDate: "时间",
    conditionMatch: "条件匹配",
    conditionTag: "标签",
    conditionText: "文本",
    createTaskNote: "创建关联笔记",
    day: "日",
    defaultView: "默认视图",
    defaultViewDesc: "打开 Task Hub 时默认显示的视图。",
    delete: "Delete",
    deleteCalendarItem: "从日历删除",
    deleteFromAppleCalendar: "从 Apple Calendar 删除",
    deleteFromAppleReminders: "从 Apple Reminders 删除",
    deleteFromDida: "从滴答删除",
    dida: "滴答清单",
    didaApiBase: "API 服务",
    didaApiBaseDesc: "国内账号选择滴答清单，国际账号选择 TickTick。",
    didaApiBaseDida: "滴答清单（国内）",
    didaApiBaseTickTick: "TickTick（国际）",
    didaApiToken: "API 口令",
    didaApiTokenDesc: "口令会保存在 Obsidian 插件数据中。建议使用测试账号，开发后轮换口令。",
    didaCreate: "创建滴答任务",
    didaCreateDesc: "允许 Task Hub 创建滴答任务，并把仓库任务发送到滴答清单。",
    didaCreateDisabled: "请先在 Task Hub 设置中开启滴答清单、滴答任务和创建滴答任务。",
    didaCreateTags: "同步滴答原生标签",
    didaCreateTagsDesc: "创建或编辑滴答任务时，把 Task Hub 标签写入滴答原生任务标签。",
    didaDefaultProject: "默认滴答清单",
    didaDefaultProjectDesc: "创建滴答任务时默认使用的清单。",
    didaDefaultProjectInbox: "默认滴答收集箱",
    didaDefaultReminder: "默认提醒提前量",
    didaDefaultReminderDesc: "到期前多少分钟提醒。填 0 表示到期时提醒。",
    didaDelete: "删除滴答任务",
    didaDeleteDesc: "允许 Task Hub 从外部来源删除滴答任务。",
    didaDesc: "通过 Open API 同步和写回滴答清单 / TickTick 任务。",
    didaDisabledDesc: "滴答清单同步已关闭。",
    didaDragReschedule: "拖动滴答任务",
    didaDragRescheduleDesc: "允许在日历中拖动滴答任务来修改日期或时间。",
    didaEnable: "滴答清单集成",
    didaProject: "滴答清单",
    didaProjectColorNoProjects: "先同步一次滴答清单以加载清单颜色。",
    didaProjectColors: "滴答清单颜色",
    didaProjectColorsDesc: "为每个滴答清单覆盖显示颜色。",
    didaTaskCreated: "已创建滴答任务。",
    didaTaskCreatedAndTaskRemoved: "已创建滴答任务，并删除源任务。",
    didaTasks: "滴答任务",
    didaTasksColor: "滴答任务颜色",
    didaTasksColorDesc: "滴答任务的默认显示颜色。",
    didaTasksDesc: "把滴答任务读取到 Task Hub。",
    didaTestConnection: "测试 / 同步",
    didaVaultOnly: "只有 vault 中的 Markdown 任务可以发送到滴答清单。",
    didaWriteback: "编辑和完成滴答任务",
    didaWritebackDesc: "允许 Task Hub 更新滴答标题、备注、清单、日期、时间和完成状态。",
    edit: "编辑",
    editDetails: "编辑详情",
    event: "事件",
    eventCreationDefaultTarget: "默认事件创建位置",
    eventCreationDefaultTargetDesc: "从日历新建事件时默认选中的 Apple 日历。",
    eventCreationDuration: "时长",
    eventCreationDurationDays: "天",
    eventCreationDurationDesc: "事件长度。全天事件使用天；定时事件使用小时和分钟。",
    eventCreationDurationHours: "小时",
    eventCreationDurationMinutes: "分钟",
    eventCreationPlaceholder: "事件标题",
    eventCreationTitle: "创建事件",
    eventUpdated: "事件已更新。",
    events: "个事件",
    externalTaskReadOnly: "外部项目默认只读；Apple 提醒事项和 Apple 日历的部分写入能力需要在设置中显式开启。",
    externalSourceOpenUnavailable: "Task Hub 无法打开这个外部来源。",
    externalCalendars: "外部日历",
    externalTaskSources: "外部任务源",
    externalTaskSourcesDesc: "开启 Apple 日历、Apple 提醒事项和滴答清单 / TickTick；拖动标签可调整默认顺序。",
    externalTaskSourcesEmpty: "先在上方开启一个外部任务源，然后在这里配置。",
    feedbackButton: "报 bug / 提建议",
    feedbackDesc: "打开 GitHub issue 页面，反馈问题、想法或使用建议。",
    feedbackTitle: "反馈",
    failed: "失败",
    failedSync: "同步失败",
    fileNotFound: "文件未找到",
    filters: "筛选",
    future: "未来",
    httpError: "HTTP 错误",
    ignoredPaths: "忽略路径",
    ignoredPathsDesc: "用逗号分隔的文件夹或文件路径前缀。",
    invalidContent: "内容无效",
    indexOnStartup: "启动时索引",
    indexOnStartupDesc: "Obsidian 启动时扫描发生变化的 Markdown 文件。",
    language: "语言",
    languageDesc: "选择 Task Hub 的界面语言。",
    lastScan: "上次扫描",
    layers: "图层",
    linePositionUnavailable: "无法定位到具体行。",
    lineChangedConflict: "任务所在行已经变化，Task Hub 无法安全识别原任务。",
    lineMismatchConflict: "索引中的任务行和文件内容不再匹配。",
    lineNoLongerOpen: "索引中的这一行已经不再是未完成任务。",
    lineOutsideFile: "索引中的任务行超出了文件范围。",
    localApple: "本地 Apple",
    localAppleError: "本地 Apple 错误",
    localAppleCalendar: "Apple 日历",
    localAppleCalendarColor: "Apple 日历颜色",
    localAppleCalendarColorDesc: "预览当前日历颜色，或选择一个更柔和的推荐颜色。",
    localAppleCalendarColorNoCalendars: "先同步一次 Apple 日历后，再配置单个日历的颜色。",
    localAppleCalendarColors: "Apple 日历分组颜色",
    localAppleCalendarColorsDesc: "按本机 Apple 日历分别覆盖渲染颜色；系统颜色合适时可以保持默认。",
    localAppleCalendarSystemColor: "系统颜色",
    localAppleCalendarDesc: "读取本机 Apple 日历事件到 Task Hub 日历中。macOS 可能会请求权限。",
    localAppleCalendarReminderConversion: "Apple 日历和提醒事项互相转换",
    localAppleCalendarReminderConversionDesc:
      "在右键菜单中加入 Apple 日历事件与 Apple 提醒事项的移动式转换。Task Hub 会先创建目标项目，再删除源项目。",
    localAppleCalendarTaskSend: "发送任务到 Apple 日历",
    localAppleCalendarTaskSendDesc:
      "允许在日历中右键带日期的 vault 任务，创建全天 Apple 日历事件；创建成功后再删除源 Markdown 任务。",
    localAppleCalendarDefaultTimedTaskDuration: "日/周视图默认拖动任务时长",
    localAppleCalendarDefaultTimedTaskDurationDesc: "拖动 vault 任务到日视图或周视图时间网格时使用的分钟数，默认 60。",
    localAppleCalendarWriteback: "拖拽改期 Apple 日历事件",
    localAppleCalendarWritebackDesc: "允许通过拖拽修改本机 Apple 日历事件日期；Task Hub 会保留事件原来的时间、时长和全天状态。",
    localAppleCheckStatus: "检查状态",
    localAppleDesc: "本地 Apple 集成只在 macOS 读取本机提醒事项和日历；只有分别开启写回选项后，才会写入 Apple 提醒事项完成状态和 Apple 日历事件日期。",
    localAppleDisabledDesc: "启用本地 Apple 后再配置本机日历和提醒事项读取。",
    localAppleHelperMissing: "Apple helper 缺失",
    localAppleHelperMissingDesc: "请安装包含 taskhub-apple-helper 的 Task Hub 发布包。",
    localAppleLookahead: "日历向后读取天数",
    localAppleLookback: "日历向前回看天数",
    localApplePermissionAuthorized: "权限已授权。",
    localApplePermissionDenied: "权限已在 macOS 隐私与安全性设置中被拒绝。",
    localApplePermissionNotDetermined: "尚未请求权限。",
    localApplePermissionRestricted: "这台 Mac 限制了该权限。",
    localAppleCalendarPermissionBlocked:
      "Apple 日历权限被阻止。请打开 macOS 系统设置 > 隐私与安全性 > 日历，允许 Obsidian 或 Task Hub Apple Helper 后重试。",
    localAppleReminders: "Apple 提醒事项",
    localAppleRemindersColor: "Apple 提醒事项颜色",
    localAppleRemindersColorDesc: "预览当前颜色，或选择一个更柔和的推荐颜色。",
    localAppleReminderColorNoLists: "先同步一次 Apple 提醒事项后，再配置单个列表的颜色。",
    localAppleReminderListColors: "Apple 提醒事项列表颜色",
    localAppleReminderListColorsDesc: "按本机 Apple 提醒事项列表分别覆盖渲染颜色。",
    localAppleRemindersDisabledDesc: "启用 Apple 提醒事项后再配置本地读取、完成状态写入和显示颜色。",
    localAppleRemindersDesc: "读取本机 Apple 提醒事项到任务列表；有日期的提醒也会进入日历。",
    localAppleRemindersCreate: "从 vault 任务创建 Apple 提醒事项",
    localAppleRemindersCreateDesc: "允许从 vault 任务创建 Apple 提醒事项；创建成功后再删除源 Markdown 任务。",
    localAppleRemindersCreateTags: "发送源标签到 Apple 提醒事项",
    localAppleRemindersCreateTagsDesc:
      "vault 任务包含标签时，将它们作为 Apple 提醒事项可识别的 #标签 追加到新提醒事项标题；嵌套标签会使用连字符。",
    localAppleRemindersCreateRiskConfirm:
      "此功能会更改你的库中的原始 Markdown 数据。Task Hub 创建 Apple 提醒事项成功后，会删除笔记中的源任务行。如果同步或索引不是最新，可能需要你手动处理重复或冲突。请在确认已备份或信任此工作流后再开启。",
    localAppleRemindersCreateRiskEnable: "确认并开启",
    localAppleRemindersCreateRiskTitle: "确认删除源任务",
    localAppleRemindersDefaultList: "默认提醒事项列表",
    localAppleRemindersDefaultListDesc: "Task Hub 新建 Apple 提醒事项时默认使用的列表。",
    localAppleRemindersDefaultListInbox: "默认提醒事项列表",
    localAppleRemindersPermissionBlocked:
      "Apple 提醒事项权限被阻止。请打开 macOS 系统设置 > 隐私与安全性 > 提醒事项，允许 Obsidian 或 Task Hub Apple Helper 后重试。",
    localAppleRemindersPermissionPending:
      "Apple 提醒事项权限仍未授权。请打开 Task Hub 设置 > 本地 Apple，点击请求权限，并在 macOS 中批准提醒事项权限。",
    localAppleRemindersWriteback: "写入 Apple 提醒事项完成状态",
    localAppleRemindersWritebackDesc: "允许通过 Task Hub 支持的控件完成、重新打开、改期和编辑本机 Apple 提醒事项。",
    localAppleRequestAccess: "请求权限",
    localAppleNoEnabledTabs: "开启 Apple 日历或 Apple 提醒事项后，再配置对应集成。",
    localAppleUnsupportedPlatform: "此功能仅支持 macOS。Apple 日历和提醒事项依赖本机 macOS 系统权限，当前系统无法启用。",
    monday: "周一",
    month: "月",
    more: "更多",
    markComplete: "标记完成",
    markOpen: "标记未完成",
    name: "名称",
    neverSynced: "从未同步",
    networkError: "网络错误",
    next: "下一页",
    notes: "笔记",
    noMatchingTasks: "没有符合当前筛选条件的任务。",
    noOpenTasks: "当前索引的仓库中没有未完成任务。",
    noTags: "索引任务中没有标签。",
    noDate: "无日期",
    noUnscheduledTasks: "没有未排期任务。",
    notSynced: "未同步",
    open: "未完成",
    openSource: "打开来源",
    openTaskHub: "打开 Task Hub",
    opened: "已打开",
    or: "或",
    otherCompleted: "其他已完成",
    overdue: "已逾期",
    parseError: "解析错误",
    previous: "上一页",
    readOnly: "只读",
    rescan: "重新扫描",
    rescanComplete: "Task Hub 已刷新。",
    rescanFailed: "Task Hub 刷新失败",
    rescanning: "刷新中...",
    rescanTaskHub: "重新扫描 Task Hub",
    remove: "删除",
    recurrence: "重复",
    recurrenceApplyTo: "应用到",
    recurrenceCustom: "自定义重复",
    recurrenceDaily: "每天",
    recurrenceEndDate: "重复截止日期",
    recurrenceEndDateRequired: "请为循环事件选择重复开始日期和截止日期。",
    recurrenceFuture: "本次及未来",
    recurrenceMonthly: "每月",
    recurrenceNone: "不重复",
    recurrenceStartDate: "重复开始日期",
    recurrenceThis: "仅本次",
    recurrenceWeekly: "每周",
    recurrenceYearly: "每年",
    reminderAlert: "提前提醒",
    reminderAlertAtTime: "到点提醒",
    reminderAlertMinutesBefore: "{minutes} 分钟前",
    reminderAlertOneDayBefore: "1 天前",
    reminderAlertOneHourBefore: "1 小时前",
    reminderAlertOneWeekBefore: "1 周前",
    reminderAlertTwoDaysBefore: "2 天前",
    date: "日期",
    endTime: "结束时间",
    save: "保存",
    search: "搜索",
    searchTags: "搜索标签",
    searchTasks: "搜索任务",
    settingsTitle: "Task Hub 设置",
    friday: "周五",
    sendCurrentTaskToAppleReminders: "将当前任务发送到 Apple 提醒事项",
    sendTo: "发送到",
    sendToAppleCalendar: "转换为 Apple 日历",
    sendToAppleReminders: "发送到 Apple 提醒事项",
    sendToAppleRemindersDisabled: "请先在设置中开启创建 Apple 提醒事项",
    sendToDida: "发送到滴答清单",
    sendToNoTargets: "请先在 Task Hub 设置中开启 Apple 提醒事项或滴答清单创建。",
    sendToTarget: "发送目标",
    sourceAppleCalendar: "Apple Calendar",
    sourceAppleReminders: "Apple Reminders",
    sourceDida: "滴答清单",
    sourceVaultTask: "vault 任务",
    showCompletedByDefault: "默认显示已完成任务",
    showCompletedByDefaultDesc: "已完成任务仍会被索引；关闭时默认隐藏。",
    showCompletedInView: "显示已完成",
    showLunarCalendar: "开启农历展示",
    showLunarCalendarDesc: "在月视图中显示农历年份、月份和每一天的农历日期。",
    skipped: "已跳过",
    sourceSearch: "文件夹或文件",
    source: "来源",
    startTime: "开始时间",
    supportedTaskSyntax: "支持的任务语法",
    supportedTaskSyntaxDesc: "版本 1 支持 - [ ]、- [x]、Obsidian 标签、📅 YYYY-MM-DD 和 due:: YYYY-MM-DD。",
    sync: "同步",
    synced: "已同步",
    tags: "标签",
    task: "任务",
    taskAlreadyCompleted: "任务已经完成。",
    taskCompleted: "任务已完成。",
    taskCreated: "任务已创建。",
    taskDateAlreadySet: "任务已经在这个日期。",
    taskDateTokenMissing: "任务行中没有可支持的日期标记。",
    taskDateUpdated: "任务日期已更新。",
    taskUpdated: "任务已更新。",
    taskCreationDefaultTarget: "默认任务创建位置",
    taskCreationDefaultTargetDesc: "从日历新建任务时默认选中的任务创建位置。",
    taskCreationBody: "正文",
    taskCreationFile: "任务创建文件",
    taskCreationFileDesc: "从日历新建的任务会追加到这个 Markdown 文件。",
    taskCreationTitle: "创建任务",
    taskCreationPlaceholder: "任务内容",
    taskCreationTime: "时间",
    taskCreationTarget: "创建到",
    taskDetails: "任务详情",
    taskHub: "Task Hub",
    taskSendDefaultTarget: "默认发送地址",
    taskSendDefaultTargetDesc: "任务详情中“发送到”按钮右侧默认选中的清单软件或清单。",
    taskNoteCreated: "任务笔记已创建。",
    taskNotesDefaultMode: "默认笔记格式",
    taskNotesDefaultModeDesc: "创建普通 Task Hub 笔记，或仅兼容 Thino multi-file 存储的笔记。",
    taskNotesDisabled: "请先在 Task Hub 设置中开启任务笔记。",
    taskNotesEnable: "任务笔记",
    taskNotesEnableDesc: "创建与任务和日历事件关联的 Markdown 笔记。",
    taskNotesFolder: "Task Hub 笔记文件夹",
    taskNotesFolderDesc: "普通 Task Hub 关联笔记保存到这个文件夹。",
    taskNotesOpenAfterCreate: "创建后打开笔记",
    taskNotesOpenAfterCreateDesc: "创建 Markdown 笔记后在新标签页打开。",
    taskNotesSection: "任务笔记",
    taskNotesShowCounts: "显示笔记数",
    taskNotesShowCountsDesc: "任务有关联笔记时，在任务列表行显示数量。",
    taskNotesShowFrontmatter: "编辑器中显示笔记元数据",
    taskNotesShowFrontmatterDesc: "打开关联笔记弹窗时显示 YAML/frontmatter 属性。默认关闭，编辑器会从正文开始。",
    taskNotesThino: "仅创建 Thino multi-file 笔记",
    taskNotesThinoDesc: "为新笔记写入 Thino multi-file frontmatter；不生成 Thino single-file、Canvas 或日记存储内容。",
    taskNotesThinoFolder: "Thino 笔记文件夹",
    taskNotesThinoFolderDesc: "Thino multi-file 存储使用的文件夹。",
    taskNoteEditInThino: "在 Thino 中编辑",
    taskNoteDeleted: "任务笔记已删除。",
    taskNoteSave: "保存笔记",
    taskNoteSaved: "任务笔记已保存。",
    taskReopened: "任务已重新打开。",
    taskUpdateFailed: "Task Hub 无法更新该任务。",
    tasks: "任务",
    tasksIndexed: "个任务已索引",
    thisWeek: "本周",
    today: "今天",
    tomorrow: "明天",
    tuesday: "周二",
    thursday: "周四",
    sunday: "周日",
    saturday: "周六",
    unscheduled: "未排期",
    unscheduledTasks: "未排期任务",
    vaultTasks: "仓库任务",
    week: "周",
    weekStartsOn: "一周开始于",
    weekStartsOnDesc: "控制周分组和日历布局。",
    wednesday: "周三"
  }
};

export type Translator = (key: TranslationKey) => string;

export function createTranslator(language: Language): Translator {
  return (key) => TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key];
}
