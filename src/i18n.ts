export const SUPPORTED_LANGUAGES = ["en", "zh", "ja", "fr", "ko"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type LanguageOption = {
  value: Language;
  label: string;
  locale: string;
  isCjk: boolean;
};

const LANGUAGE_METADATA: Record<Language, Omit<LanguageOption, "value">> = {
  en: { label: "English", locale: "en-US", isCjk: false },
  zh: { label: "中文", locale: "zh-CN", isCjk: true },
  ja: { label: "日本語", locale: "ja-JP", isCjk: true },
  fr: { label: "Français", locale: "fr-FR", isCjk: false },
  ko: { label: "한국어", locale: "ko-KR", isCjk: true }
};

export const LANGUAGE_OPTIONS: LanguageOption[] = SUPPORTED_LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_METADATA[value].label,
  locale: LANGUAGE_METADATA[value].locale,
  isCjk: LANGUAGE_METADATA[value].isCjk
}));

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

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
  | "quickTagFilter"
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
  | "externalTaskLookahead"
  | "externalTaskLookaheadDesc"
  | "externalTaskLookback"
  | "externalTaskLookbackDesc"
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
  | "location"
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
  | "noSmartLists"
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
  | "removeFromSmartList"
  | "removeFromSmartListHint"
  | "smartListDragInNotice"
  | "smartListDragOutNotice"
  | "smartListDragStartNotice"
  | "deleteSmartList"
  | "renameSmartList"
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
  | "reminderAlertNone"
  | "reminderAlertOneDayBefore"
  | "reminderAlertOneHourBefore"
  | "reminderAlertOneWeekBefore"
  | "reminderAlertTwoDaysBefore"
  | "search"
  | "searchTags"
  | "searchTasks"
  | "saveSmartList"
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
  | "showSubtaskProgressBars"
  | "showSubtaskProgressBarsDesc"
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
  | "sourceFile"
  | "smartLists"
  | "smartListColor"
  | "smartListColorBlue"
  | "smartListColorCyan"
  | "smartListColorDefault"
  | "smartListColorGreen"
  | "smartListColorOrange"
  | "smartListColorPurple"
  | "smartListColorRed"
  | "smartListDeleted"
  | "smartListNamePrompt"
  | "smartListSaved"
  | "save"
  | "startTime"
  | "endTime"
  | "date"
  | "readOnly"
  | "supportedTaskSyntax"
  | "supportedTaskSyntaxDesc"
  | "subtaskProgress"
  | "subtaskProgressTreeHint"
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
  | "taskUndoApplied"
  | "taskUndoUnavailable"
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
  | "undoLastTaskChange"
  | "taskSendDefaultTarget"
  | "taskSendDefaultTargetDesc"
  | "tagPlaceholder"
  | "taskNoteCreated"
  | "taskNotesDefaultMode"
  | "taskNotesDefaultModeDesc"
  | "taskNotesDisabled"
  | "taskNotesEnable"
  | "taskNotesEnableDesc"
  | "taskNotesFolder"
  | "taskNotesFolderDesc"
  | "taskNotesLinkedSubtasks"
  | "taskNotesLinkedSubtasksDesc"
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
  | "taskNoteEditSource"
  | "taskNoteEditInThino"
  | "taskNoteDeleted"
  | "taskNotePin"
  | "taskNoteSave"
  | "taskNoteSaved"
  | "taskNoteUnpin"
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

const JA_SETTINGS_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
  appleReminderList: "Apple リマインダーリスト",
  calendarCreationDefaultKind: "デフォルトの作成タイプ",
  calendarCreationDefaultKindDesc: "カレンダーから新規作成するときに既定で選ばれるタイプ。",
  calendarDayEndHour: "日/週ビューの終了時刻",
  calendarDayEndHourDesc: "日ビューと週ビューで既定表示する最も遅い時刻。さらに遅い項目がある場合は範囲が自動で広がります。",
  calendarDayStartHour: "日/週ビューの開始時刻",
  calendarDayStartHourDesc: "日ビューと週ビューで既定表示する最も早い時刻。さらに早い項目がある場合は範囲が自動で広がります。",
  calendarTaskCreation: "カレンダーから作成",
  calendarTaskCreationDesc: "カレンダーの空き領域をクリックして、タスクまたは Apple カレンダーイベントを作成します。",
  dida: "Dida",
  didaApiBase: "API サービス",
  didaApiBaseDesc: "中国国内アカウントは Dida、国際アカウントは TickTick を選びます。",
  didaApiBaseDida: "Dida（中国）",
  didaApiBaseTickTick: "TickTick（国際）",
  didaApiToken: "API トークン",
  didaApiTokenDesc: "トークンは Obsidian プラグインデータに保存されます。テスト用アカウントを使い、開発後にローテーションすることをおすすめします。",
  didaCreate: "Dida タスクを作成",
  didaCreateDesc: "Task Hub が Dida タスクを作成し、Vault タスクを Dida に送信できるようにします。",
  didaCreateTags: "Dida ネイティブタグを同期",
  didaCreateTagsDesc: "Dida タスクの作成または編集時に、Task Hub のタグを Dida のネイティブタスクタグへ書き込みます。",
  didaDefaultProject: "デフォルト Dida プロジェクト",
  didaDefaultProjectDesc: "Dida タスク作成時に既定で使うプロジェクト。",
  didaDefaultProjectInbox: "デフォルト Dida 受信箱",
  didaDefaultReminder: "デフォルト通知オフセット",
  didaDefaultReminderDesc: "期限の何分前に通知するか。0 は期限時刻を意味します。",
  didaDelete: "Dida タスクを削除",
  didaDeleteDesc: "Task Hub が外部ソースから Dida タスクを削除できるようにします。",
  didaDesc: "Open API 経由で Dida / TickTick タスクを同期して書き戻します。",
  didaDisabledDesc: "Dida 同期はオフです。",
  didaDragReschedule: "Dida タスクをドラッグ",
  didaDragRescheduleDesc: "カレンダー上で Dida タスクをドラッグして日付または時刻を変更できるようにします。",
  didaEnable: "Dida 連携",
  didaProject: "Dida プロジェクト",
  didaProjectColorNoProjects: "プロジェクト色を設定するには、先に Dida を一度同期してください。",
  didaProjectColors: "Dida プロジェクト色",
  didaProjectColorsDesc: "各 Dida プロジェクトの表示色を上書きします。",
  didaTasks: "Dida タスク",
  didaTasksDesc: "Dida タスクを Task Hub に読み込みます。",
  didaTestConnection: "テスト / 同期",
  didaWriteback: "Dida タスクを編集・完了",
  didaWritebackDesc: "Task Hub が Dida のタイトル、メモ、プロジェクト、日付、時刻、完了状態を更新できるようにします。",
  eventCreationDefaultTarget: "デフォルトのイベント作成先",
  eventCreationDefaultTargetDesc: "カレンダーから新規イベントを作成するときに既定で選ばれる Apple カレンダー。",
  externalTaskSourcesDesc: "Apple カレンダー、Apple リマインダー、Dida / TickTick を有効化します。タブをドラッグして既定の順序を調整できます。",
  externalTaskSourcesEmpty: "上で外部タスクソースを有効にすると、ここで設定できます。",
  externalTaskLookahead: "外部タスク先読み日数",
  externalTaskLookaheadDesc: "外部タスクの今後何日分まで読み込んで保持するかを設定します。既定は 100 日です。",
  externalTaskLookback: "外部タスク過去読み込み日数",
  externalTaskLookbackDesc: "外部タスクの過去何日分まで読み込んで保持するかを設定します。既定は 100 日です。",
  failedSync: "同期失敗",
  feedbackButton: "バグ報告 / 提案",
  feedbackDesc: "GitHub issue ページを開き、問題、アイデア、利用上の提案を送信します。",
  feedbackTitle: "フィードバック",
  httpError: "HTTP エラー",
  invalidContent: "無効な内容",
  localApple: "ローカル Apple",
  localAppleCalendar: "Apple カレンダー",
  localAppleCalendarColor: "Apple カレンダー色",
  localAppleCalendarColorDesc: "現在の色をプレビューするか、より柔らかい推奨色を選びます。",
  localAppleCalendarColorNoCalendars: "個別カレンダーの色を設定するには、先に Apple カレンダーを一度同期してください。",
  localAppleCalendarColors: "Apple カレンダー別の色",
  localAppleCalendarColorsDesc: "ローカル Apple カレンダーごとに表示色を上書きします。システム色が適切な場合は既定のままにできます。",
  localAppleCalendarDefaultTimedTaskDuration: "日/週ビューのデフォルトドラッグ時間",
  localAppleCalendarDefaultTimedTaskDurationDesc: "Vault タスクを日ビューまたは週ビューの時間グリッドへドラッグしたときに使う分数。最小 5、既定は 60 です。",
  localAppleCalendarDesc: "ローカル Apple カレンダーイベントを Task Hub カレンダーへ読み込みます。macOS が権限を求める場合があります。",
  localAppleCalendarReminderConversion: "Apple カレンダーとリマインダーを相互変換",
  localAppleCalendarReminderConversionDesc: "右クリックメニューに Apple カレンダーイベントと Apple リマインダーの移動型変換を追加します。Task Hub は先に対象項目を作成し、その後ソース項目を削除します。",
  localAppleCalendarSystemColor: "システム色",
  localAppleCalendarTaskSend: "タスクを Apple カレンダーへ送信",
  localAppleCalendarTaskSendDesc: "カレンダー上で日付付き Vault タスクを右クリックし、終日 Apple カレンダーイベントを作成できるようにします。成功後に元の Markdown タスクを削除します。",
  localAppleCalendarWriteback: "Apple カレンダーイベントをドラッグで日程変更",
  localAppleCalendarWritebackDesc: "ドラッグでローカル Apple カレンダーイベントの日付を変更できるようにします。元の時刻、長さ、終日状態は保持されます。",
  localAppleCheckStatus: "状態を確認",
  localAppleDesc: "ローカル Apple 連携は macOS 上のリマインダーとカレンダーを読み込みます。個別の書き戻し設定を有効にした場合のみ、Apple リマインダーの完了状態や Apple カレンダーイベントの日付を書き込みます。",
  localAppleDisabledDesc: "ローカル Apple を有効にしてから、ローカルカレンダーとリマインダーの読み込みを設定してください。",
  localAppleError: "ローカル Apple エラー",
  localAppleHelperMissing: "Apple helper が見つかりません",
  localAppleHelperMissingDesc: "taskhub-apple-helper を含む Task Hub リリースパッケージをインストールしてください。",
  localAppleLookahead: "カレンダー先読み日数",
  localAppleLookback: "カレンダー過去読み込み日数",
  localAppleNoEnabledTabs: "Apple カレンダーまたは Apple リマインダーを有効にすると、その連携を設定できます。",
  localApplePermissionDenied: "権限は macOS のプライバシーとセキュリティ設定で拒否されています。",
  localApplePermissionNotDetermined: "権限はまだ要求されていません。",
  localApplePermissionRestricted: "この Mac ではこの権限が制限されています。",
  localAppleReminderColorNoLists: "個別リストの色を設定するには、先に Apple リマインダーを一度同期してください。",
  localAppleReminderListColors: "Apple リマインダーリスト色",
  localAppleReminderListColorsDesc: "ローカル Apple リマインダーリストごとに表示色を上書きします。",
  localAppleReminders: "Apple リマインダー",
  localAppleRemindersColor: "Apple リマインダー色",
  localAppleRemindersColorDesc: "現在の色をプレビューするか、より柔らかい推奨色を選びます。",
  localAppleRemindersCreate: "Vault タスクから Apple リマインダーを作成",
  localAppleRemindersCreateDesc: "Vault タスクから Apple リマインダーを作成できるようにします。作成成功後に元の Markdown タスクを削除します。",
  localAppleRemindersCreateTags: "ソースタグを Apple リマインダーへ送信",
  localAppleRemindersCreateTagsDesc: "Vault タスクにタグがある場合、新しいリマインダーのタイトルへ Apple リマインダーのハッシュタグとして追加します。ネストしたタグはハイフンを使います。",
  localAppleRemindersDefaultList: "デフォルトのリマインダーリスト",
  localAppleRemindersDefaultListDesc: "Task Hub から新しい Apple リマインダーを作成するときの既定リスト。",
  localAppleRemindersDefaultListInbox: "デフォルトのリマインダーリスト",
  localAppleRemindersDesc: "ローカル Apple リマインダーをタスクリストに読み込み、日付付きリマインダーはカレンダーにも表示します。",
  localAppleRemindersDisabledDesc: "Apple リマインダーを有効にしてから、ローカル読み込み、完了状態の書き戻し、表示色を設定してください。",
  localAppleRemindersWriteback: "完了状態を Apple リマインダーへ書き戻す",
  localAppleRemindersWritebackDesc: "Task Hub の対応コントロールから、ローカル Apple リマインダーの完了、再オープン、日程変更、編集を行えるようにします。",
  localAppleRequestAccess: "アクセスを要求",
  parseError: "解析エラー",
  supportedTaskSyntax: "対応タスク構文",
  supportedTaskSyntaxDesc: "バージョン 1 は - [ ]、- [x]、Obsidian タグ、📅 YYYY-MM-DD、due:: YYYY-MM-DD に対応します。",
  taskCreationDefaultTarget: "デフォルトのタスク作成先",
  taskCreationDefaultTargetDesc: "カレンダーからタスクを作成するときに既定で選ばれる作成先。",
  taskCreationFile: "タスク作成ファイル",
  taskCreationFileDesc: "カレンダーで新規作成したタスクはこの Markdown ファイルへ追加されます。",
  taskNotesDefaultMode: "デフォルトのノート形式",
  taskNotesDefaultModeDesc: "通常の Task Hub ノート、または Thino multi-file ストレージ専用ノートを作成します。",
  taskNotesEnable: "タスクノート",
  taskNotesEnableDesc: "タスクやカレンダーイベントに紐づく Markdown ノートを作成します。",
  taskNotesFolder: "Task Hub ノートフォルダー",
  taskNotesFolderDesc: "通常の Task Hub 関連ノートを保存するフォルダー。",
  taskNotesLinkedSubtasks: "関連ノートからサブタスクを検出",
  taskNotesLinkedSubtasksDesc: "有効にすると、関連ノート本文内の Markdown タスクを親タスクのサブタスク候補として読み取ります。",
  taskNotesOpenAfterCreate: "作成後にノートを開く",
  taskNotesOpenAfterCreateDesc: "作成した Markdown ノートを新しいタブで開きます。",
  taskNotesSection: "タスクノート",
  taskNotesShowCounts: "ノート数を表示",
  taskNotesShowCountsDesc: "ノートがある場合、タスクリスト行にノート数を表示します。",
  taskNotesShowFrontmatter: "エディターにノートメタデータを表示",
  taskNotesShowFrontmatterDesc: "関連ノートのポップアップを開くときに YAML/frontmatter プロパティを表示します。既定ではオフで、エディターは本文から始まります。",
  taskNotesThino: "Thino multi-file ノートのみ作成",
  taskNotesThinoDesc: "新規ノートに Thino multi-file frontmatter を使います。Thino single-file、Canvas、日記ストレージは生成しません。",
  taskNotesThinoFolder: "Thino ノートフォルダー",
  taskNotesThinoFolderDesc: "Thino multi-file ストレージで使うフォルダー。",
  taskNoteEditSource: "ソースファイルで編集",
  taskNotePin: "ノートをピン留め",
  taskNoteUnpin: "ノートのピン留めを解除",
  taskSendDefaultTarget: "デフォルトの送信先",
  taskSendDefaultTargetDesc: "タスク詳細の「送信先」ボタン横で既定選択される送信先。"
};

const FR_SETTINGS_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
  appleReminderList: "Liste Apple Reminders",
  calendarCreationDefaultKind: "Type de création par défaut",
  calendarCreationDefaultKindDesc: "Type sélectionné par défaut lors d'une création depuis le calendrier.",
  calendarDayEndHour: "Heure de fin jour/semaine",
  calendarDayEndHourDesc: "Heure la plus tardive affichée par défaut dans les vues jour et semaine. Les éléments plus tardifs étendent automatiquement la plage.",
  calendarDayStartHour: "Heure de début jour/semaine",
  calendarDayStartHourDesc: "Heure la plus tôt affichée par défaut dans les vues jour et semaine. Les éléments plus tôt étendent automatiquement la plage.",
  calendarTaskCreation: "Créer depuis le calendrier",
  calendarTaskCreationDesc: "Cliquez dans un espace vide du calendrier pour créer une tâche ou un événement Apple Calendar.",
  dida: "Dida",
  didaApiBase: "Service API",
  didaApiBaseDesc: "Choisissez Dida pour les comptes chinois et TickTick pour les comptes internationaux.",
  didaApiBaseDida: "Dida (Chine)",
  didaApiBaseTickTick: "TickTick (international)",
  didaApiToken: "Jeton API",
  didaApiTokenDesc: "Le jeton est stocké dans les données du plugin Obsidian. Utilisez de préférence un compte de test et renouvelez le jeton après le développement.",
  didaCreate: "Créer des tâches Dida",
  didaCreateDesc: "Autorise Task Hub à créer des tâches Dida et à envoyer des tâches du coffre vers Dida.",
  didaCreateTags: "Synchroniser les étiquettes natives Dida",
  didaCreateTagsDesc: "Lors de la création ou modification de tâches Dida, écrit les étiquettes Task Hub dans les étiquettes natives Dida.",
  didaDefaultProject: "Projet Dida par défaut",
  didaDefaultProjectDesc: "Projet utilisé par défaut pour créer des tâches Dida.",
  didaDefaultProjectInbox: "Boîte de réception Dida par défaut",
  didaDefaultReminder: "Rappel par défaut",
  didaDefaultReminderDesc: "Nombre de minutes avant l'échéance. 0 signifie au moment de l'échéance.",
  didaDelete: "Supprimer les tâches Dida",
  didaDeleteDesc: "Autorise Task Hub à supprimer des tâches Dida depuis les sources externes.",
  didaDesc: "Synchronise et écrit les tâches Dida / TickTick via l'Open API.",
  didaDisabledDesc: "La synchronisation Dida est désactivée.",
  didaDragReschedule: "Glisser les tâches Dida",
  didaDragRescheduleDesc: "Autorise le glisser-déposer des tâches Dida dans le calendrier pour modifier leur date ou heure.",
  didaEnable: "Intégration Dida",
  didaProject: "Projet Dida",
  didaProjectColorNoProjects: "Synchronisez Dida une fois pour charger les couleurs des projets.",
  didaProjectColors: "Couleurs des projets Dida",
  didaProjectColorsDesc: "Remplace la couleur d'affichage de chaque projet Dida.",
  didaTasks: "Tâches Dida",
  didaTasksDesc: "Lit les tâches Dida dans Task Hub.",
  didaTestConnection: "Tester / synchroniser",
  didaWriteback: "Modifier et terminer les tâches Dida",
  didaWritebackDesc: "Autorise Task Hub à mettre à jour le titre, les notes, le projet, la date, l'heure et l'état d'achèvement Dida.",
  eventCreationDefaultTarget: "Destination d'événement par défaut",
  eventCreationDefaultTargetDesc: "Apple Calendar sélectionné par défaut lors de la création d'un événement depuis le calendrier.",
  externalTaskSourcesDesc: "Active Apple Calendar, Apple Reminders et Dida / TickTick ; faites glisser les onglets pour ajuster l'ordre par défaut.",
  externalTaskSourcesEmpty: "Activez d'abord une source de tâches externe ci-dessus, puis configurez-la ici.",
  externalTaskLookahead: "Jours futurs des tâches externes",
  externalTaskLookaheadDesc: "Nombre de jours futurs de tâches externes à lire et conserver. Valeur par défaut : 100.",
  externalTaskLookback: "Jours passés des tâches externes",
  externalTaskLookbackDesc: "Nombre de jours passés de tâches externes à lire et conserver. Valeur par défaut : 100.",
  failedSync: "Échec de synchronisation",
  feedbackButton: "Signaler un bug / proposer",
  feedbackDesc: "Ouvre la page GitHub issue pour envoyer un problème, une idée ou une suggestion d'utilisation.",
  feedbackTitle: "Retour",
  httpError: "Erreur HTTP",
  invalidContent: "Contenu invalide",
  localApple: "Apple local",
  localAppleCalendar: "Apple Calendar",
  localAppleCalendarColor: "Couleur Apple Calendar",
  localAppleCalendarColorDesc: "Prévisualisez la couleur actuelle ou choisissez une couleur recommandée plus douce.",
  localAppleCalendarColorNoCalendars: "Synchronisez Apple Calendar une fois pour configurer les couleurs de chaque calendrier.",
  localAppleCalendarColors: "Couleurs des calendriers Apple",
  localAppleCalendarColorsDesc: "Remplace la couleur de rendu de chaque calendrier Apple local ; conservez la couleur système si elle convient.",
  localAppleCalendarDefaultTimedTaskDuration: "Durée de glisser par défaut en vue jour/semaine",
  localAppleCalendarDefaultTimedTaskDurationDesc: "Nombre de minutes utilisé lorsqu'une tâche du coffre est déposée dans la grille horaire jour ou semaine. Minimum : 5 ; par défaut : 60.",
  localAppleCalendarDesc: "Lit les événements Apple Calendar locaux dans le calendrier Task Hub. macOS peut demander une autorisation.",
  localAppleCalendarReminderConversion: "Convertir entre Apple Calendar et Reminders",
  localAppleCalendarReminderConversionDesc: "Ajoute au menu contextuel une conversion par déplacement entre événements Apple Calendar et rappels Apple. Task Hub crée d'abord l'élément cible puis supprime l'élément source.",
  localAppleCalendarSystemColor: "Couleur système",
  localAppleCalendarTaskSend: "Envoyer les tâches vers Apple Calendar",
  localAppleCalendarTaskSendDesc: "Autorise le clic droit sur une tâche du coffre datée dans le calendrier pour créer un événement Apple Calendar sur toute la journée ; la tâche Markdown source est supprimée après succès.",
  localAppleCalendarWriteback: "Replanifier les événements Apple Calendar par glisser",
  localAppleCalendarWritebackDesc: "Autorise la modification de date des événements Apple Calendar locaux par glisser-déposer ; Task Hub conserve l'heure, la durée et l'état toute la journée.",
  localAppleCheckStatus: "Vérifier l'état",
  localAppleDesc: "L'intégration Apple locale lit les rappels et calendriers de ce Mac. Elle écrit uniquement l'état d'achèvement Apple Reminders et les dates Apple Calendar lorsque les options d'écriture correspondantes sont activées.",
  localAppleDisabledDesc: "Activez Apple local avant de configurer la lecture du calendrier et des rappels locaux.",
  localAppleError: "Erreur Apple locale",
  localAppleHelperMissing: "Apple helper manquant",
  localAppleHelperMissingDesc: "Installez le paquet Task Hub contenant taskhub-apple-helper.",
  localAppleLookahead: "Jours futurs à lire",
  localAppleLookback: "Jours passés à lire",
  localAppleNoEnabledTabs: "Activez Apple Calendar ou Apple Reminders pour configurer cette intégration.",
  localApplePermissionDenied: "L'autorisation a été refusée dans les réglages macOS Confidentialité et sécurité.",
  localApplePermissionNotDetermined: "L'autorisation n'a pas encore été demandée.",
  localApplePermissionRestricted: "Ce Mac restreint cette autorisation.",
  localAppleReminderColorNoLists: "Synchronisez Apple Reminders une fois pour configurer les couleurs de chaque liste.",
  localAppleReminderListColors: "Couleurs des listes Apple Reminders",
  localAppleReminderListColorsDesc: "Remplace la couleur d'affichage de chaque liste Apple Reminders locale.",
  localAppleReminders: "Apple Reminders",
  localAppleRemindersColor: "Couleur Apple Reminders",
  localAppleRemindersColorDesc: "Prévisualisez la couleur actuelle ou choisissez une couleur recommandée plus douce.",
  localAppleRemindersCreate: "Créer des Apple Reminders depuis les tâches du coffre",
  localAppleRemindersCreateDesc: "Autorise la création de rappels Apple depuis les tâches du coffre, puis supprime la tâche Markdown source après succès.",
  localAppleRemindersCreateTags: "Envoyer les étiquettes source vers Apple Reminders",
  localAppleRemindersCreateTagsDesc: "Si une tâche du coffre a des étiquettes, les ajoute au titre du nouveau rappel sous forme de hashtags Apple Reminders. Les étiquettes imbriquées utilisent des tirets.",
  localAppleRemindersDefaultList: "Liste Reminders par défaut",
  localAppleRemindersDefaultListDesc: "Liste par défaut pour les nouveaux rappels Apple créés depuis Task Hub.",
  localAppleRemindersDefaultListInbox: "Liste Reminders par défaut",
  localAppleRemindersDesc: "Lit les Apple Reminders locaux dans la liste de tâches et affiche les rappels datés dans le calendrier.",
  localAppleRemindersDisabledDesc: "Activez Apple Reminders pour configurer la lecture locale, l'écriture de l'état d'achèvement et la couleur d'affichage.",
  localAppleRemindersWriteback: "Écrire l'état d'achèvement dans Apple Reminders",
  localAppleRemindersWritebackDesc: "Autorise les contrôles Task Hub compatibles à terminer, rouvrir, replanifier et modifier les Apple Reminders locaux.",
  localAppleRequestAccess: "Demander l'accès",
  parseError: "Erreur d'analyse",
  supportedTaskSyntax: "Syntaxe de tâche prise en charge",
  supportedTaskSyntaxDesc: "La version 1 prend en charge - [ ], - [x], les étiquettes Obsidian, 📅 YYYY-MM-DD et due:: YYYY-MM-DD.",
  taskCreationDefaultTarget: "Destination de tâche par défaut",
  taskCreationDefaultTargetDesc: "Destination sélectionnée par défaut lorsque vous créez une tâche depuis le calendrier.",
  taskCreationFile: "Fichier de création de tâches",
  taskCreationFileDesc: "Les nouvelles tâches du calendrier sont ajoutées à ce fichier Markdown.",
  taskNotesDefaultMode: "Format de note par défaut",
  taskNotesDefaultModeDesc: "Crée des notes Task Hub simples ou des notes compatibles uniquement avec le stockage multi-fichier Thino.",
  taskNotesEnable: "Notes de tâche",
  taskNotesEnableDesc: "Crée des notes Markdown liées aux tâches et événements du calendrier.",
  taskNotesFolder: "Dossier des notes Task Hub",
  taskNotesFolderDesc: "Dossier des notes liées Task Hub classiques.",
  taskNotesLinkedSubtasks: "Détecter les sous-tâches dans les notes liées",
  taskNotesLinkedSubtasksDesc: "Lorsque cette option est activée, les tâches Markdown dans le corps des notes liées peuvent être lues comme sous-tâches de la tâche parente.",
  taskNotesOpenAfterCreate: "Ouvrir la note après création",
  taskNotesOpenAfterCreateDesc: "Ouvre la note Markdown créée dans un nouvel onglet.",
  taskNotesSection: "Notes de tâche",
  taskNotesShowCounts: "Afficher le nombre de notes",
  taskNotesShowCountsDesc: "Affiche le nombre de notes sur les lignes de tâches lorsqu'il existe des notes.",
  taskNotesShowFrontmatter: "Afficher les métadonnées dans l'éditeur",
  taskNotesShowFrontmatterDesc: "Affiche les propriétés YAML/frontmatter lors de l'ouverture des fenêtres de note liée. Désactivé par défaut pour commencer dans le corps de la note.",
  taskNotesThino: "Créer uniquement des notes Thino multi-fichier",
  taskNotesThinoDesc: "Utilise le frontmatter Thino multi-fichier pour les nouvelles notes. Les stockages Thino single-file, Canvas et journal ne sont pas générés.",
  taskNotesThinoFolder: "Dossier des notes Thino",
  taskNotesThinoFolderDesc: "Dossier utilisé par le stockage multi-fichier Thino.",
  taskNotePin: "Épingler la note",
  taskNoteUnpin: "Désépingler la note",
  taskSendDefaultTarget: "Destination d'envoi par défaut",
  taskSendDefaultTargetDesc: "Destination sélectionnée par défaut à côté du bouton Envoyer vers dans les détails de tâche."
};

const KO_SETTINGS_TRANSLATIONS: Partial<Record<TranslationKey, string>> = {
  appleReminderList: "Apple 미리 알림 목록",
  calendarCreationDefaultKind: "기본 생성 유형",
  calendarCreationDefaultKindDesc: "캘린더에서 새로 만들 때 기본으로 선택되는 유형입니다.",
  calendarDayEndHour: "일/주 보기 종료 시간",
  calendarDayEndHourDesc: "일 보기와 주 보기에서 기본으로 표시할 가장 늦은 시간입니다. 더 늦은 항목이 있으면 범위가 자동으로 확장됩니다.",
  calendarDayStartHour: "일/주 보기 시작 시간",
  calendarDayStartHourDesc: "일 보기와 주 보기에서 기본으로 표시할 가장 이른 시간입니다. 더 이른 항목이 있으면 범위가 자동으로 확장됩니다.",
  calendarTaskCreation: "캘린더에서 생성",
  calendarTaskCreationDesc: "캘린더의 빈 공간을 클릭해 작업 또는 Apple 캘린더 이벤트를 생성합니다.",
  dida: "Dida",
  didaApiBase: "API 서비스",
  didaApiBaseDesc: "중국 계정은 Dida, 국제 계정은 TickTick을 선택합니다.",
  didaApiBaseDida: "Dida(중국)",
  didaApiBaseTickTick: "TickTick(국제)",
  didaApiToken: "API 토큰",
  didaApiTokenDesc: "토큰은 Obsidian 플러그인 데이터에 저장됩니다. 테스트 계정을 사용하고 개발 후 토큰을 교체하는 것을 권장합니다.",
  didaCreate: "Dida 작업 생성",
  didaCreateDesc: "Task Hub가 Dida 작업을 생성하고 vault 작업을 Dida로 보낼 수 있게 합니다.",
  didaCreateTags: "Dida 기본 태그 동기화",
  didaCreateTagsDesc: "Dida 작업을 생성하거나 편집할 때 Task Hub 태그를 Dida 기본 작업 태그로 기록합니다.",
  didaDefaultProject: "기본 Dida 프로젝트",
  didaDefaultProjectDesc: "Dida 작업을 생성할 때 기본으로 사용할 프로젝트입니다.",
  didaDefaultProjectInbox: "기본 Dida 받은 편지함",
  didaDefaultReminder: "기본 알림 오프셋",
  didaDefaultReminderDesc: "마감 몇 분 전에 알릴지 설정합니다. 0은 마감 시각 알림을 의미합니다.",
  didaDelete: "Dida 작업 삭제",
  didaDeleteDesc: "Task Hub가 외부 소스에서 Dida 작업을 삭제할 수 있게 합니다.",
  didaDesc: "Open API를 통해 Dida / TickTick 작업을 동기화하고 다시 씁니다.",
  didaDisabledDesc: "Dida 동기화가 꺼져 있습니다.",
  didaDragReschedule: "Dida 작업 드래그",
  didaDragRescheduleDesc: "캘린더에서 Dida 작업을 드래그해 날짜 또는 시간을 변경할 수 있게 합니다.",
  didaEnable: "Dida 연동",
  didaProject: "Dida 프로젝트",
  didaProjectColorNoProjects: "프로젝트 색상을 설정하려면 먼저 Dida를 한 번 동기화하세요.",
  didaProjectColors: "Dida 프로젝트 색상",
  didaProjectColorsDesc: "각 Dida 프로젝트의 표시 색상을 재정의합니다.",
  didaTasks: "Dida 작업",
  didaTasksDesc: "Dida 작업을 Task Hub로 읽어옵니다.",
  didaTestConnection: "테스트 / 동기화",
  didaWriteback: "Dida 작업 편집 및 완료",
  didaWritebackDesc: "Task Hub가 Dida 제목, 메모, 프로젝트, 날짜, 시간, 완료 상태를 업데이트할 수 있게 합니다.",
  eventCreationDefaultTarget: "기본 이벤트 생성 위치",
  eventCreationDefaultTargetDesc: "캘린더에서 새 이벤트를 만들 때 기본으로 선택되는 Apple 캘린더입니다.",
  externalTaskSourcesDesc: "Apple 캘린더, Apple 미리 알림, Dida / TickTick을 켭니다. 탭을 드래그해 기본 순서를 조정할 수 있습니다.",
  externalTaskSourcesEmpty: "위에서 외부 작업 소스를 먼저 켠 다음 여기에서 설정하세요.",
  externalTaskLookahead: "외부 작업 앞으로 읽을 일수",
  externalTaskLookaheadDesc: "외부 작업을 앞으로 며칠까지 읽고 유지할지 설정합니다. 기본값은 100일입니다.",
  externalTaskLookback: "외부 작업 뒤로 읽을 일수",
  externalTaskLookbackDesc: "외부 작업을 과거 며칠까지 읽고 유지할지 설정합니다. 기본값은 100일입니다.",
  failedSync: "동기화 실패",
  feedbackButton: "버그 신고 / 제안",
  feedbackDesc: "GitHub issue 페이지를 열어 문제, 아이디어, 사용 제안을 보냅니다.",
  feedbackTitle: "피드백",
  httpError: "HTTP 오류",
  invalidContent: "잘못된 콘텐츠",
  localApple: "로컬 Apple",
  localAppleCalendar: "Apple 캘린더",
  localAppleCalendarColor: "Apple 캘린더 색상",
  localAppleCalendarColorDesc: "현재 색상을 미리 보거나 더 부드러운 추천 색상을 선택합니다.",
  localAppleCalendarColorNoCalendars: "개별 캘린더 색상을 설정하려면 먼저 Apple 캘린더를 한 번 동기화하세요.",
  localAppleCalendarColors: "Apple 캘린더별 색상",
  localAppleCalendarColorsDesc: "로컬 Apple 캘린더별 렌더링 색상을 재정의합니다. 시스템 색상이 적절하면 기본값을 유지할 수 있습니다.",
  localAppleCalendarDefaultTimedTaskDuration: "일/주 보기 기본 드래그 작업 길이",
  localAppleCalendarDefaultTimedTaskDurationDesc: "vault 작업을 일 보기 또는 주 보기 시간 그리드로 드래그할 때 사용할 분 단위 길이입니다. 최소 5, 기본값은 60입니다.",
  localAppleCalendarDesc: "로컬 Apple 캘린더 이벤트를 Task Hub 캘린더로 읽어옵니다. macOS가 권한을 요청할 수 있습니다.",
  localAppleCalendarReminderConversion: "Apple 캘린더와 미리 알림 상호 변환",
  localAppleCalendarReminderConversionDesc: "오른쪽 클릭 메뉴에 Apple 캘린더 이벤트와 Apple 미리 알림의 이동식 변환을 추가합니다. Task Hub는 대상 항목을 먼저 만든 다음 원본 항목을 삭제합니다.",
  localAppleCalendarSystemColor: "시스템 색상",
  localAppleCalendarTaskSend: "작업을 Apple 캘린더로 보내기",
  localAppleCalendarTaskSendDesc: "캘린더에서 날짜가 있는 vault 작업을 오른쪽 클릭해 하루 종일 Apple 캘린더 이벤트를 만들 수 있게 합니다. 성공 후 원본 Markdown 작업을 삭제합니다.",
  localAppleCalendarWriteback: "드래그로 Apple 캘린더 이벤트 일정 변경",
  localAppleCalendarWritebackDesc: "드래그로 로컬 Apple 캘린더 이벤트 날짜를 변경할 수 있게 합니다. Task Hub는 기존 시간, 길이, 하루 종일 상태를 유지합니다.",
  localAppleCheckStatus: "상태 확인",
  localAppleDesc: "로컬 Apple 연동은 macOS의 미리 알림과 캘린더를 읽습니다. 각각의 쓰기 옵션을 켠 경우에만 Apple 미리 알림 완료 상태와 Apple 캘린더 이벤트 날짜를 씁니다.",
  localAppleDisabledDesc: "로컬 Apple을 켠 뒤 로컬 캘린더와 미리 알림 읽기를 설정하세요.",
  localAppleError: "로컬 Apple 오류",
  localAppleHelperMissing: "Apple helper 없음",
  localAppleHelperMissingDesc: "taskhub-apple-helper가 포함된 Task Hub 릴리스 패키지를 설치하세요.",
  localAppleLookahead: "캘린더 앞으로 읽을 일수",
  localAppleLookback: "캘린더 뒤로 읽을 일수",
  localAppleNoEnabledTabs: "Apple 캘린더 또는 Apple 미리 알림을 켜면 해당 연동을 설정할 수 있습니다.",
  localApplePermissionDenied: "macOS 개인정보 보호 및 보안 설정에서 권한이 거부되었습니다.",
  localApplePermissionNotDetermined: "아직 권한을 요청하지 않았습니다.",
  localApplePermissionRestricted: "이 Mac에서 해당 권한이 제한되어 있습니다.",
  localAppleReminderColorNoLists: "개별 목록 색상을 설정하려면 먼저 Apple 미리 알림을 한 번 동기화하세요.",
  localAppleReminderListColors: "Apple 미리 알림 목록 색상",
  localAppleReminderListColorsDesc: "로컬 Apple 미리 알림 목록별 표시 색상을 재정의합니다.",
  localAppleReminders: "Apple 미리 알림",
  localAppleRemindersColor: "Apple 미리 알림 색상",
  localAppleRemindersColorDesc: "현재 색상을 미리 보거나 더 부드러운 추천 색상을 선택합니다.",
  localAppleRemindersCreate: "vault 작업에서 Apple 미리 알림 생성",
  localAppleRemindersCreateDesc: "vault 작업에서 Apple 미리 알림을 생성할 수 있게 합니다. 생성 성공 후 원본 Markdown 작업을 삭제합니다.",
  localAppleRemindersCreateTags: "소스 태그를 Apple 미리 알림으로 보내기",
  localAppleRemindersCreateTagsDesc: "vault 작업에 태그가 있으면 새 미리 알림 제목에 Apple 미리 알림 해시태그로 추가합니다. 중첩 태그는 하이픈을 사용합니다.",
  localAppleRemindersDefaultList: "기본 미리 알림 목록",
  localAppleRemindersDefaultListDesc: "Task Hub에서 새 Apple 미리 알림을 만들 때 기본으로 사용할 목록입니다.",
  localAppleRemindersDefaultListInbox: "기본 미리 알림 목록",
  localAppleRemindersDesc: "로컬 Apple 미리 알림을 작업 목록으로 읽고, 날짜가 있는 미리 알림은 캘린더에도 표시합니다.",
  localAppleRemindersDisabledDesc: "Apple 미리 알림을 켠 뒤 로컬 읽기, 완료 상태 쓰기, 표시 색상을 설정하세요.",
  localAppleRemindersWriteback: "완료 상태를 Apple 미리 알림에 쓰기",
  localAppleRemindersWritebackDesc: "Task Hub의 지원 컨트롤에서 로컬 Apple 미리 알림을 완료, 다시 열기, 일정 변경, 편집할 수 있게 합니다.",
  localAppleRequestAccess: "접근 권한 요청",
  parseError: "구문 분석 오류",
  supportedTaskSyntax: "지원하는 작업 구문",
  supportedTaskSyntaxDesc: "버전 1은 - [ ], - [x], Obsidian 태그, 📅 YYYY-MM-DD, due:: YYYY-MM-DD를 지원합니다.",
  taskCreationDefaultTarget: "기본 작업 생성 위치",
  taskCreationDefaultTargetDesc: "캘린더에서 작업을 만들 때 기본으로 선택되는 생성 위치입니다.",
  taskCreationFile: "작업 생성 파일",
  taskCreationFileDesc: "새 캘린더 작업은 이 Markdown 파일에 추가됩니다.",
  taskNotesDefaultMode: "기본 노트 형식",
  taskNotesDefaultModeDesc: "일반 Task Hub 노트 또는 Thino multi-file 저장소 전용 노트를 생성합니다.",
  taskNotesEnable: "작업 노트",
  taskNotesEnableDesc: "작업과 캘린더 이벤트에 연결된 Markdown 노트를 생성합니다.",
  taskNotesFolder: "Task Hub 노트 폴더",
  taskNotesFolderDesc: "일반 Task Hub 연결 노트를 저장할 폴더입니다.",
  taskNotesLinkedSubtasks: "연결된 노트에서 하위 작업 감지",
  taskNotesLinkedSubtasksDesc: "켜면 연결된 노트 본문의 Markdown 작업을 부모 작업의 하위 작업 후보로 읽습니다.",
  taskNotesOpenAfterCreate: "생성 후 노트 열기",
  taskNotesOpenAfterCreateDesc: "생성한 Markdown 노트를 새 탭에서 엽니다.",
  taskNotesSection: "작업 노트",
  taskNotesShowCounts: "노트 수 표시",
  taskNotesShowCountsDesc: "노트가 있는 경우 작업 목록 행에 노트 수를 표시합니다.",
  taskNotesShowFrontmatter: "편집기에 노트 메타데이터 표시",
  taskNotesShowFrontmatterDesc: "연결된 노트 팝업을 열 때 YAML/frontmatter 속성을 표시합니다. 기본값은 꺼짐이며 편집기는 노트 본문에서 시작합니다.",
  taskNotesThino: "Thino multi-file 노트만 생성",
  taskNotesThinoDesc: "새 노트에 Thino multi-file frontmatter를 사용합니다. Thino single-file, Canvas, diary 저장소는 생성하지 않습니다.",
  taskNotesThinoFolder: "Thino 노트 폴더",
  taskNotesThinoFolderDesc: "Thino multi-file 저장소에서 사용하는 폴더입니다.",
  taskNotePin: "노트 고정",
  taskNoteUnpin: "노트 고정 해제",
  taskSendDefaultTarget: "기본 보내기 대상",
  taskSendDefaultTargetDesc: "작업 세부 정보의 보내기 버튼 옆에서 기본으로 선택되는 대상입니다."
};

const TRANSLATIONS: Record<"en" | "zh", Record<TranslationKey, string>> &
  Record<Exclude<Language, "en" | "zh">, Partial<Record<TranslationKey, string>>> = {
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
    quickTagFilter: "Quick tag",
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
    externalTaskLookahead: "External task lookahead days",
    externalTaskLookaheadDesc: "How many future days of external tasks to read and keep. Default: 100.",
    externalTaskLookback: "External task lookback days",
    externalTaskLookbackDesc: "How many past days of external tasks to read and keep. Default: 100.",
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
    location: "Location",
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
      "Minutes to use when dragging a vault task onto the day or week time grid. Minimum is 5; default is 60.",
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
    noSmartLists: "No smart lists yet.",
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
    removeFromSmartList: "Remove from smart list",
    removeFromSmartListHint: "Drag tasks from the smart list here to remove them from the smart list.",
    deleteSmartList: "Delete smart list",
    renameSmartList: "Rename",
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
    reminderAlertNone: "No reminder",
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
    saveSmartList: "Smart lists turn your current filters into a quick access entry.",
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
    showSubtaskProgressBars: "Show subtask progress bars",
    showSubtaskProgressBarsDesc: "Show a progress bar on tasks that contain subtasks. Progress is calculated from the full subtask tree.",
    showCompletedInView: "Show completed",
    showLunarCalendar: "Show lunar dates",
    showLunarCalendarDesc: "Display Chinese lunar dates in the month calendar when the interface language is Chinese.",
    skipped: "skipped",
    sourceSearch: "Folder or file",
    source: "Source",
    sourceFile: "Source file",
    smartListDragInNotice: "Dragged {count} tasks into {name}.",
    smartListDragOutNotice: "Dragged {count} tasks out of {name}.",
    smartListDragStartNotice: "Dragging {count} tasks from {name}.",
    smartLists: "Smart lists",
    smartListColor: "Color",
    smartListColorBlue: "Blue",
    smartListColorCyan: "Cyan",
    smartListColorDefault: "Default",
    smartListColorGreen: "Green",
    smartListColorOrange: "Orange",
    smartListColorPurple: "Purple",
    smartListColorRed: "Red",
    smartListDeleted: "Smart list deleted.",
    smartListNamePrompt: "Smart list name",
    smartListSaved: "Smart list saved.",
    startTime: "Start time",
    subtaskProgress: "Subtask progress",
    subtaskProgressTreeHint: "Based on the full subtask tree.",
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
    taskDateTokenMissing: "The task line does not contain a supported scheduling date.",
    taskDateUpdated: "Task date updated.",
    taskUndoApplied: "Undid the last task change.",
    taskUndoUnavailable: "No recent task change is available to undo.",
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
    undoLastTaskChange: "Undo last task change",
    taskSendDefaultTarget: "Default send destination",
    taskSendDefaultTargetDesc: "Default destination selected beside the Send to button in task details.",
    tagPlaceholder: "Add tag",
    taskNoteCreated: "Task note created.",
    taskNotesDefaultMode: "Default note format",
    taskNotesDefaultModeDesc: "Create plain Task Hub notes or notes compatible only with Thino multi-file storage.",
    taskNotesDisabled: "Turn on task notes in Task Hub settings first.",
    taskNotesEnable: "Task notes",
    taskNotesEnableDesc: "Create Markdown notes linked to tasks and calendar events.",
    taskNotesFolder: "Task Hub notes folder",
    taskNotesFolderDesc: "Folder for regular Task Hub linked notes.",
    taskNotesLinkedSubtasks: "Detect subtasks in linked notes",
    taskNotesLinkedSubtasksDesc: "When enabled, Markdown tasks in linked note bodies can be read as subtasks of the parent task.",
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
    taskNoteEditSource: "Edit source file",
    taskNoteEditInThino: "Edit in Thino",
    taskNoteDeleted: "Task note deleted.",
    taskNotePin: "Pin note",
    taskNoteSave: "Save note",
    taskNoteSaved: "Task note saved.",
    taskNoteUnpin: "Unpin note",
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
    quickTagFilter: "快捷标签",
    createTaskNote: "创建关联笔记",
    day: "日",
    defaultView: "默认视图",
    defaultViewDesc: "打开 Task Hub 时默认显示的视图。",
    delete: "删除",
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
    externalTaskLookahead: "外部任务向后读取天数",
    externalTaskLookaheadDesc: "外部任务未来保留多少天并参与读取。默认 100 天。",
    externalTaskLookback: "外部任务向前回看天数",
    externalTaskLookbackDesc: "外部任务过去保留多少天并参与读取。默认 100 天。",
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
    location: "地点",
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
    localAppleCalendarDefaultTimedTaskDurationDesc: "拖动 vault 任务到日视图或周视图时间网格时使用的分钟数，最小 5，默认 60。",
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
    noSmartLists: "还没有智能列表。",
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
    removeFromSmartList: "从智能列表中移除",
    removeFromSmartListHint: "将智能列表中的任务拖到这里会将任务从智能列表中移除",
    deleteSmartList: "删除智能列表",
    renameSmartList: "重命名",
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
    reminderAlert: "提醒",
    reminderAlertAtTime: "到点提醒",
    reminderAlertMinutesBefore: "{minutes} 分钟前",
    reminderAlertNone: "不提醒",
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
    saveSmartList: "智能列表功能可以把你当前的筛选内容变成一个可以快速访问的入口",
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
    showSubtaskProgressBars: "显示子任务进度条",
    showSubtaskProgressBarsDesc: "为包含子任务的任务显示进度条。进度会根据完整子任务树自动计算。",
    showCompletedInView: "显示已完成",
    showLunarCalendar: "开启农历展示",
    showLunarCalendarDesc: "在月视图中显示农历年份、月份和每一天的农历日期。",
    skipped: "已跳过",
    sourceSearch: "文件夹或文件",
    source: "来源",
    sourceFile: "来源文件",
    smartListDragInNotice: "已将 {count} 个任务拖入「{name}」。",
    smartListDragOutNotice: "已从「{name}」拖出 {count} 个任务。",
    smartListDragStartNotice: "从「{name}」智能列表中拖动 {count} 个任务。",
    smartLists: "智能列表",
    smartListColor: "配色",
    smartListColorBlue: "蓝色",
    smartListColorCyan: "青色",
    smartListColorDefault: "默认",
    smartListColorGreen: "绿色",
    smartListColorOrange: "橙色",
    smartListColorPurple: "紫色",
    smartListColorRed: "红色",
    smartListDeleted: "智能列表已删除。",
    smartListNamePrompt: "智能列表名称",
    smartListSaved: "智能列表已保存。",
    startTime: "时间",
    subtaskProgress: "子任务进度",
    subtaskProgressTreeHint: "基于完整子任务树计算。",
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
    taskUndoApplied: "已撤销刚才的任务修改。",
    taskUndoUnavailable: "没有可撤销的最近任务修改。",
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
    undoLastTaskChange: "撤销刚才的任务修改",
    taskSendDefaultTarget: "默认发送地址",
    taskSendDefaultTargetDesc: "任务详情中“发送到”按钮右侧默认选中的清单软件或清单。",
    tagPlaceholder: "添加标签",
    taskNoteCreated: "任务笔记已创建。",
    taskNotesDefaultMode: "默认笔记格式",
    taskNotesDefaultModeDesc: "创建普通 Task Hub 笔记，或仅兼容 Thino multi-file 存储的笔记。",
    taskNotesDisabled: "请先在 Task Hub 设置中开启任务笔记。",
    taskNotesEnable: "任务笔记",
    taskNotesEnableDesc: "创建与任务和日历事件关联的 Markdown 笔记。",
    taskNotesFolder: "Task Hub 笔记文件夹",
    taskNotesFolderDesc: "普通 Task Hub 关联笔记保存到这个文件夹。",
    taskNotesLinkedSubtasks: "从关联笔记检索子任务",
    taskNotesLinkedSubtasksDesc: "开启后，关联笔记正文里的 Markdown 任务可作为父任务的子任务候选读取。",
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
    taskNoteEditSource: "在源文件编辑",
    taskNoteEditInThino: "在 Thino 中编辑",
    taskNoteDeleted: "任务笔记已删除。",
    taskNotePin: "置顶笔记",
    taskNoteSave: "保存笔记",
    taskNoteSaved: "任务笔记已保存。",
    taskNoteUnpin: "取消置顶笔记",
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
  },
  ja: {
    ...JA_SETTINGS_TRANSLATIONS,
    add: "追加",
    addIcsSource: "ICS ソースを追加",
    addIcsSourceDesc: "公開されている読み取り専用の .ics URL を追加します。",
    all: "すべて",
    allDay: "終日",
    and: "かつ",
    anyDate: "任意の日付",
    applyFilters: "フィルター",
    calendar: "カレンダー",
    calendarEmpty: "この期間にタスクまたはイベントはありません。",
    calendarDetails: "カレンダー詳細",
    cancel: "キャンセル",
    clearFilters: "クリア",
    completed: "完了",
    context: "コンテキスト",
    day: "日",
    defaultView: "デフォルト表示",
    defaultViewDesc: "Task Hub を開いたときに最初に表示するビュー。",
    delete: "削除",
    edit: "編集",
    editDetails: "詳細を編集",
    event: "イベント",
    events: "件のイベント",
    externalCalendars: "外部カレンダー",
    externalTaskSources: "外部タスクソース",
    failed: "失敗",
    filters: "フィルター",
    friday: "金曜日",
    future: "今後",
    ignoredPaths: "無視するパス",
    ignoredPathsDesc: "フォルダーまたはファイルのパス接頭辞をカンマ区切りで入力します。",
    indexOnStartup: "起動時に索引化",
    indexOnStartupDesc: "Obsidian 起動時に変更された Markdown ファイルをスキャンします。",
    language: "言語",
    languageDesc: "Task Hub の表示言語を選択します。",
    lastScan: "前回のスキャン",
    location: "場所",
    layers: "レイヤー",
    markComplete: "完了にする",
    markOpen: "未完了に戻す",
    monday: "月曜日",
    month: "月",
    more: "さらに",
    name: "名前",
    networkError: "ネットワークエラー",
    neverSynced: "未同期",
    next: "次へ",
    noDate: "日付なし",
    noMatchingTasks: "現在のフィルターに一致するタスクはありません。",
    noOpenTasks: "索引化された Vault に未完了タスクはありません。",
    noTags: "索引化されたタスクにタグはありません。",
    noUnscheduledTasks: "未予定のタスクはありません。",
    notes: "ノート",
    notSynced: "未同期",
    open: "未完了",
    openSource: "ソースを開く",
    taskNoteEditSource: "ソースファイルで編集",
    taskNoteEditInThino: "Thino で編集",
    openTaskHub: "Task Hub を開く",
    or: "または",
    otherCompleted: "その他の完了",
    overdue: "期限切れ",
    previous: "前へ",
    readOnly: "読み取り専用",
    remove: "削除",
    rescan: "再スキャン",
    rescanComplete: "Task Hub を更新しました。",
    rescanFailed: "Task Hub の更新に失敗しました",
    rescanning: "再スキャン中...",
    rescanTaskHub: "Task Hub を再スキャン",
    save: "保存",
    search: "検索",
    searchTags: "タグを検索",
    searchTasks: "タスクを検索",
    settingsTitle: "Task Hub 設定",
    saturday: "土曜日",
    sendTo: "送信先",
    showCompletedByDefault: "完了タスクを既定で表示",
    showCompletedByDefaultDesc: "完了タスクは索引に残りますが、この設定がオフの場合は既定で非表示です。",
    showSubtaskProgressBars: "サブタスク進捗バーを表示",
    showSubtaskProgressBarsDesc: "サブタスクを持つタスクに進捗バーを表示します。進捗はサブタスクツリー全体から計算されます。",
    showCompletedInView: "完了を表示",
    showLunarCalendar: "旧暦を表示",
    showLunarCalendarDesc: "中国語インターフェイスの月カレンダーに旧暦の日付を表示します。",
    source: "ソース",
    sourceFile: "ソースファイル",
    sourceSearch: "フォルダーまたはファイル",
    startTime: "開始時刻",
    subtaskProgress: "サブタスク進捗",
    subtaskProgressTreeHint: "サブタスクツリー全体に基づいて計算されます。",
    endTime: "終了時刻",
    date: "日付",
    sync: "同期",
    synced: "同期済み",
    tags: "タグ",
    task: "タスク",
    taskAlreadyCompleted: "タスクはすでに完了しています。",
    taskCompleted: "タスクを完了しました。",
    taskCreated: "タスクを作成しました。",
    taskDateAlreadySet: "タスクはすでにその日付にあります。",
    taskDateUpdated: "タスクの日付を更新しました。",
    taskDetails: "タスク詳細",
    taskHub: "Task Hub",
    undoLastTaskChange: "直前のタスク変更を元に戻す",
    taskUndoApplied: "直前のタスク変更を元に戻しました。",
    taskUndoUnavailable: "元に戻せる最近のタスク変更はありません。",
    taskUpdateFailed: "Task Hub はタスクを更新できませんでした。",
    tasks: "タスク",
    tasksIndexed: "件のタスクを索引化",
    thisWeek: "今週",
    thursday: "木曜日",
    today: "今日",
    tomorrow: "明日",
    tuesday: "火曜日",
    sunday: "日曜日",
    unscheduled: "未予定",
    unscheduledTasks: "未予定のタスク",
    vaultTasks: "Vault タスク",
    week: "週",
    weekStartsOn: "週の開始日",
    weekStartsOnDesc: "週グループとカレンダー配置を制御します。",
    wednesday: "水曜日"
  },
  fr: {
    ...FR_SETTINGS_TRANSLATIONS,
    add: "Ajouter",
    addIcsSource: "Ajouter une source ICS",
    addIcsSourceDesc: "Ajoutez une URL .ics publique en lecture seule.",
    all: "Tout",
    allDay: "Toute la journée",
    and: "et",
    anyDate: "N'importe quelle date",
    applyFilters: "Filtrer",
    calendar: "Calendrier",
    calendarEmpty: "Aucune tâche ni aucun événement dans cette période.",
    calendarDetails: "Détails du calendrier",
    cancel: "Annuler",
    clearFilters: "Effacer",
    completed: "Terminée",
    context: "Contexte",
    day: "Jour",
    defaultView: "Vue par défaut",
    defaultViewDesc: "Vue affichée par défaut à l'ouverture de Task Hub.",
    delete: "Supprimer",
    edit: "Modifier",
    editDetails: "Modifier les détails",
    event: "Événement",
    events: "événements",
    externalCalendars: "Calendriers externes",
    externalTaskSources: "Sources de tâches externes",
    failed: "Échec",
    filters: "Filtres",
    friday: "Vendredi",
    future: "À venir",
    ignoredPaths: "Chemins ignorés",
    ignoredPathsDesc: "Préfixes de dossiers ou de fichiers, séparés par des virgules.",
    indexOnStartup: "Indexer au démarrage",
    indexOnStartupDesc: "Analyser les fichiers Markdown modifiés au démarrage d'Obsidian.",
    language: "Langue",
    languageDesc: "Choisissez la langue de l'interface de Task Hub.",
    lastScan: "Dernier scan",
    location: "Lieu",
    layers: "Calques",
    markComplete: "Marquer comme terminée",
    markOpen: "Marquer comme ouverte",
    monday: "Lundi",
    month: "Mois",
    more: "plus",
    name: "Nom",
    networkError: "Erreur réseau",
    neverSynced: "Jamais synchronisé",
    next: "Suivant",
    noDate: "Sans date",
    noMatchingTasks: "Aucune tâche ne correspond aux filtres actuels.",
    noOpenTasks: "Aucune tâche ouverte trouvée dans le coffre indexé.",
    noTags: "Aucune étiquette trouvée dans les tâches indexées.",
    noUnscheduledTasks: "Aucune tâche non planifiée.",
    notes: "Notes",
    notSynced: "non synchronisé",
    open: "Ouverte",
    openSource: "Ouvrir la source",
    taskNoteEditSource: "Modifier le fichier source",
    taskNoteEditInThino: "Modifier dans Thino",
    openTaskHub: "Ouvrir Task Hub",
    or: "ou",
    otherCompleted: "Autres terminées",
    overdue: "En retard",
    previous: "Précédent",
    readOnly: "Lecture seule",
    remove: "Retirer",
    rescan: "Réanalyser",
    rescanComplete: "Task Hub a été actualisé.",
    rescanFailed: "L'actualisation de Task Hub a échoué",
    rescanning: "Réanalyse...",
    rescanTaskHub: "Réanalyser Task Hub",
    save: "Enregistrer",
    search: "Rechercher",
    searchTags: "Rechercher des étiquettes",
    searchTasks: "Rechercher des tâches",
    settingsTitle: "Paramètres de Task Hub",
    saturday: "Samedi",
    sendTo: "Envoyer vers",
    showCompletedByDefault: "Afficher les tâches terminées par défaut",
    showCompletedByDefaultDesc: "Les tâches terminées restent indexées, mais sont masquées par défaut sauf si cette option est activée.",
    showSubtaskProgressBars: "Afficher les barres de progression des sous-tâches",
    showSubtaskProgressBarsDesc: "Affiche une barre de progression sur les tâches qui contiennent des sous-tâches. La progression est calculée à partir de l'arborescence complète des sous-tâches.",
    showCompletedInView: "Afficher les terminées",
    showLunarCalendar: "Afficher les dates lunaires",
    showLunarCalendarDesc: "Afficher les dates lunaires chinoises dans le calendrier mensuel lorsque l'interface est en chinois.",
    source: "Source",
    sourceFile: "Fichier source",
    sourceSearch: "Dossier ou fichier",
    startTime: "Heure de début",
    subtaskProgress: "Progression des sous-tâches",
    subtaskProgressTreeHint: "Calculée à partir de l'arborescence complète des sous-tâches.",
    endTime: "Heure de fin",
    date: "Date",
    sync: "Synchroniser",
    synced: "Synchronisé",
    tags: "Étiquettes",
    task: "Tâche",
    taskAlreadyCompleted: "La tâche est déjà terminée.",
    taskCompleted: "Tâche terminée.",
    taskCreated: "Tâche créée.",
    taskDateAlreadySet: "La tâche est déjà à cette date.",
    taskDateUpdated: "Date de la tâche mise à jour.",
    taskDetails: "Détails de la tâche",
    taskHub: "Task Hub",
    undoLastTaskChange: "Annuler la dernière modification de tâche",
    taskUndoApplied: "La dernière modification de tâche a été annulée.",
    taskUndoUnavailable: "Aucune modification de tâche récente ne peut être annulée.",
    taskUpdateFailed: "Task Hub n'a pas pu mettre à jour la tâche.",
    tasks: "Tâches",
    tasksIndexed: "tâches indexées",
    thisWeek: "Cette semaine",
    thursday: "Jeudi",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    tuesday: "Mardi",
    sunday: "Dimanche",
    unscheduled: "Non planifiées",
    unscheduledTasks: "Tâches non planifiées",
    vaultTasks: "Tâches du coffre",
    week: "Semaine",
    weekStartsOn: "La semaine commence le",
    weekStartsOnDesc: "Contrôle le regroupement hebdomadaire et la disposition du calendrier.",
    wednesday: "Mercredi"
  },
  ko: {
    ...KO_SETTINGS_TRANSLATIONS,
    add: "추가",
    addIcsSource: "ICS 소스 추가",
    addIcsSourceDesc: "공개 읽기 전용 .ics URL을 추가합니다.",
    all: "전체",
    allDay: "하루 종일",
    and: "그리고",
    anyDate: "모든 날짜",
    applyFilters: "필터",
    calendar: "캘린더",
    calendarEmpty: "현재 기간에 작업이나 이벤트가 없습니다.",
    calendarDetails: "캘린더 세부 정보",
    cancel: "취소",
    clearFilters: "지우기",
    completed: "완료됨",
    context: "컨텍스트",
    day: "일",
    defaultView: "기본 보기",
    defaultViewDesc: "Task Hub를 열 때 기본으로 표시할 보기입니다.",
    delete: "삭제",
    edit: "편집",
    editDetails: "세부 정보 편집",
    event: "이벤트",
    events: "개 이벤트",
    externalCalendars: "외부 캘린더",
    externalTaskSources: "외부 작업 소스",
    failed: "실패",
    filters: "필터",
    friday: "금요일",
    future: "향후",
    ignoredPaths: "무시할 경로",
    ignoredPathsDesc: "쉼표로 구분한 폴더 또는 파일 경로 접두사입니다.",
    indexOnStartup: "시작 시 인덱싱",
    indexOnStartupDesc: "Obsidian 시작 시 변경된 Markdown 파일을 스캔합니다.",
    language: "언어",
    languageDesc: "Task Hub 인터페이스 언어를 선택합니다.",
    lastScan: "마지막 스캔",
    location: "장소",
    layers: "레이어",
    markComplete: "완료로 표시",
    markOpen: "미완료로 표시",
    monday: "월요일",
    month: "월",
    more: "더 보기",
    name: "이름",
    networkError: "네트워크 오류",
    neverSynced: "동기화 안 됨",
    next: "다음",
    noDate: "날짜 없음",
    noMatchingTasks: "현재 필터와 일치하는 작업이 없습니다.",
    noOpenTasks: "인덱싱된 vault에 미완료 작업이 없습니다.",
    noTags: "인덱싱된 작업에서 태그를 찾을 수 없습니다.",
    noUnscheduledTasks: "일정 없는 작업이 없습니다.",
    notes: "노트",
    notSynced: "동기화 안 됨",
    open: "미완료",
    openSource: "소스 열기",
    taskNoteEditSource: "원본 파일에서 편집",
    taskNoteEditInThino: "Thino에서 편집",
    openTaskHub: "Task Hub 열기",
    or: "또는",
    otherCompleted: "기타 완료",
    overdue: "기한 지남",
    previous: "이전",
    readOnly: "읽기 전용",
    remove: "제거",
    rescan: "다시 스캔",
    rescanComplete: "Task Hub가 새로 고쳐졌습니다.",
    rescanFailed: "Task Hub 새로 고침 실패",
    rescanning: "다시 스캔 중...",
    rescanTaskHub: "Task Hub 다시 스캔",
    save: "저장",
    search: "검색",
    searchTags: "태그 검색",
    searchTasks: "작업 검색",
    settingsTitle: "Task Hub 설정",
    saturday: "토요일",
    sendTo: "보내기",
    showCompletedByDefault: "완료된 작업을 기본으로 표시",
    showCompletedByDefaultDesc: "완료된 작업은 계속 인덱싱되지만 이 옵션을 켜지 않으면 기본적으로 숨겨집니다.",
    showSubtaskProgressBars: "하위 작업 진행률 막대 표시",
    showSubtaskProgressBarsDesc: "하위 작업이 있는 작업에 진행률 막대를 표시합니다. 진행률은 전체 하위 작업 트리를 기준으로 계산됩니다.",
    showCompletedInView: "완료 표시",
    showLunarCalendar: "음력 날짜 표시",
    showLunarCalendarDesc: "인터페이스 언어가 중국어일 때 월간 캘린더에 중국 음력 날짜를 표시합니다.",
    source: "소스",
    sourceFile: "소스 파일",
    sourceSearch: "폴더 또는 파일",
    startTime: "시작 시간",
    subtaskProgress: "하위 작업 진행률",
    subtaskProgressTreeHint: "전체 하위 작업 트리를 기준으로 계산됩니다.",
    endTime: "종료 시간",
    date: "날짜",
    sync: "동기화",
    synced: "동기화됨",
    tags: "태그",
    task: "작업",
    taskAlreadyCompleted: "작업이 이미 완료되었습니다.",
    taskCompleted: "작업이 완료되었습니다.",
    taskCreated: "작업이 생성되었습니다.",
    taskDateAlreadySet: "작업이 이미 해당 날짜에 있습니다.",
    taskDateUpdated: "작업 날짜가 업데이트되었습니다.",
    taskDetails: "작업 세부 정보",
    taskHub: "Task Hub",
    undoLastTaskChange: "마지막 작업 변경 되돌리기",
    taskUndoApplied: "방금 작업 변경을 되돌렸습니다.",
    taskUndoUnavailable: "되돌릴 최근 작업 변경이 없습니다.",
    taskUpdateFailed: "Task Hub가 작업을 업데이트할 수 없습니다.",
    tasks: "작업",
    tasksIndexed: "개 작업 인덱싱됨",
    thisWeek: "이번 주",
    thursday: "목요일",
    today: "오늘",
    tomorrow: "내일",
    tuesday: "화요일",
    sunday: "일요일",
    unscheduled: "일정 없음",
    unscheduledTasks: "일정 없는 작업",
    vaultTasks: "Vault 작업",
    week: "주",
    weekStartsOn: "주 시작 요일",
    weekStartsOnDesc: "주별 그룹과 캘린더 레이아웃을 제어합니다.",
    wednesday: "수요일"
  }
};

export type Translator = ((key: TranslationKey) => string) & {
  language?: Language;
  locale?: string;
  isCjk?: boolean;
};

export function createTranslator(language: Language): Translator {
  const metadata = LANGUAGE_METADATA[language];
  const translate = ((key: TranslationKey) => TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key]) as Translator;
  translate.language = language;
  translate.locale = metadata.locale;
  translate.isCjk = metadata.isCjk;
  return translate;
}

export function hasTranslation(language: Language, key: TranslationKey): boolean {
  return Object.prototype.hasOwnProperty.call(TRANSLATIONS[language], key);
}
