# Task and Event Notes Design

Date: 2026-05-29
Status: requirements draft, no implementation started

## Goal

Task Hub should let users attach Markdown notes to tasks and calendar events, then view those notes beside the selected item. The relationship should be stored in YAML frontmatter inside the note files so the data remains plain Markdown, queryable by Obsidian, and recoverable outside Task Hub.

The feature must be optional. When disabled in settings, Task Hub must not show note actions, note counts, or the notes container.

## Source Research

Obsidian stores note properties as YAML frontmatter at the top of a Markdown file, between `---` delimiters, and supports structured property values such as text, lists, dates, and date-times. Obsidian also notes that properties are plain text and nested properties have limitations in the UI, so Task Hub should keep its frontmatter schema shallow and predictable.

Thino stores content from user notes. In basic diary mode, Thino writes timestamped list items into daily notes, commonly like `- 22:15 {content}`. Thino Pro multi-source mode adds multiple storage modes. In multi-file mode, each Thino is a complete Markdown note and Thino stores its metadata in YAML frontmatter. Thino documentation warns that, outside diary mode, `id` and `createdAt` are important metadata and should not be modified without special reason.

Implication: Task Hub can support "create a Thino-compatible note" only for Thino multi-file mode. It should not claim universal Thino compatibility with diary, single-file callout, or canvas modes in the first version.

References:
- https://www.mintlify.com/obsidianmd/obsidian-help/editing/properties
- https://github.com/Quorafind/Obsidian-Thino
- https://thino.pkmer.net/en/thino/02_thino-advanced/thino-multi-souce/
- https://thino.pkmer.net/thino/02_thino-advanced/thino-settings

## Existing Task Hub Touchpoints

Current code already has the surfaces this feature should extend:

- `src/types.ts` defines `TaskItem`, `CalendarEvent`, and `TaskHubSettings`.
- `src/settings.ts` defines `DEFAULT_SETTINGS`, normalization, and the settings UI.
- `src/views/renderTasksView.ts` renders list rows, right-click menus, selected task details, and the detail side pane.
- `src/views/renderCalendarView.ts` renders calendar items, context menus, and task/event detail popovers.
- `src/views/TaskHubView.ts` owns selected task state and wires UI handlers to plugin methods.
- `src/main.ts` owns vault reads/writes, Apple Reminders send/writeback, Apple Calendar operations, and view refresh.
- `src/appleReminderMigration.test.ts`, `src/views/renderTasksView.test.ts`, `src/views/renderCalendarView.test.ts`, and settings tests already cover adjacent behavior.

## First Version Scope

### In Scope

- Settings toggle: enable/disable Task Hub item notes globally.
- Settings for note storage:
  - default Task Hub notes folder;
  - default note mode: Task Hub note or Thino multi-file note;
  - optional Thino folder path;
  - optional Thino-compatible frontmatter creation toggle.
- Right-click menu action on task rows: create/link a note for the task.
- Right-click menu action on calendar task/event items: create/link a note for the task or event.
- Detail side pane note container for selected task in list view.
- Calendar detail popover note container for selected calendar item, or a consistent detail container if calendar selection is later promoted to side-pane style.
- Task list row note count badge in the upper-right corner; hidden when count is zero.
- Note display by click:
  - a compact list of linked notes in a dedicated note container;
  - each note item opens the note in Obsidian when clicked;
  - no container is rendered when no notes exist.
- YAML frontmatter relationship index:
  - notes declare their related Task Hub item(s);
  - Task Hub scans note frontmatter to derive counts and note lists;
  - note files remain normal Markdown.
- Migration/update behavior when sending a vault task to Apple Reminders:
  - linked task notes must be updated so the new Apple Reminder remains associated;
  - the original vault task reference should be preserved as history/alias for recovery.

### Out of Scope for First Version

- Editing note body inside Task Hub.
- Creating, editing, deleting, or moving external calendar events beyond existing capabilities.
- Writing to ICS sources.
- Full Thino API integration, Thino server integration, or Thino diary/single-file/canvas generation.
- Bulk attach/detach operations.
- Bidirectional sync with arbitrary user-renamed external events.
- Mobile-specific layout verification beyond keeping the DOM/CSS responsive.
- Using YAML frontmatter to store long note body text.

## User Stories

- As a user, I can right-click a task and create a note associated with that task.
- As a user, I can right-click an event and create a note associated with that event.
- As a user, I can select a task and see its associated notes in the detail side area.
- As a user, I can see a small note count on task cards that have notes.
- As a Thino user, I can choose to create notes that Thino multi-file mode can index.
- As a user who sends vault tasks to Apple Reminders, I do not lose the task-note relationship when the source Markdown task is deleted after send.

## Proposed Data Model

Use a shallow frontmatter schema to avoid Obsidian property UI edge cases.

### Task Hub Note Frontmatter

```yaml
---
taskhub-note: true
taskhub-note-id: "thn_20260529_103012_abcd"
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-related-history:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-created: 2026-05-29T10:30:12
taskhub-updated: 2026-05-29T10:30:12
tags:
  - task-hub-note
---
```

Use string relationship keys in lists instead of nested objects. This keeps the schema readable and searchable, and avoids nested property limitations in Obsidian's UI.

### Relationship Key Shape

The relationship key should be deterministic for indexing, but not so brittle that normal source changes break all links.

Recommended forms:

- Vault task: `task:vault:{filePath}:{line}:{lineHash}`
- Apple Reminder task: `task:apple-reminders:{externalId}`
- ICS event: `event:{sourceId}:{eventId}:{startDate}`
- Apple Calendar event: `event:apple-calendar:{eventId}:{startDate}`

`taskhub-related-history` preserves older keys when an item is migrated or sent. Task Hub should match current keys first, then history keys only for display/recovery if the current key is missing.

### Thino Multi-file Note Frontmatter

When Thino-compatible creation is enabled, Task Hub should create a normal Markdown note in the configured Thino folder and include the metadata Thino expects for multi-file mode, plus Task Hub fields.

Draft shape:

```yaml
---
id: "20260529103012"
createdAt: 2026-05-29T10:30:12
updatedAt: 2026-05-29T10:30:12
taskhub-note: true
taskhub-note-id: "thn_20260529_103012_abcd"
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
tags:
  - task-hub-note
---
```

Boundary: Task Hub should set `id` and `createdAt` only when creating a new Thino-compatible note. It must not rewrite existing Thino `id` or `createdAt` during later relationship updates.

## Settings

Add a "Task notes" settings section:

- `taskNotes.enabled`: default `false`.
- `taskNotes.notesFolder`: default `Task Hub Notes`.
- `taskNotes.defaultMode`: `task-hub` or `thino-multi-file`, default `task-hub`.
- `taskNotes.thinoIntegrationEnabled`: default `false`.
- `taskNotes.thinoFolder`: default `Thino`.
- `taskNotes.openNoteAfterCreate`: default `true`.
- `taskNotes.showCountsInTaskList`: default `true`.

All settings require English and Chinese translations in `src/i18n.ts`.

## UI Behavior

### Task List

- Right-click menu gains "Add note" or "Create linked note" when task notes are enabled.
- If a task has notes and counts are enabled, render a compact count badge at the upper-right of the task row.
- Selecting a task renders a note container below the existing task detail facts/actions.
- The note container is omitted when there are no notes.
- Clicking a note row opens the note source file.

### Calendar

- Calendar item context menu gains the same note action for tasks and events when task notes are enabled.
- Calendar detail popover shows linked notes when present.
- Read-only external events can have local notes because the relationship is written to the note file, not to the event source.
- If an event has unstable identity, Task Hub should still create a note but include a warning-level fallback in the relationship history by title/date/source.

## Send and Conversion Behavior

### Vault Task Sent to Apple Reminders

Current behavior creates an Apple Reminder, records `settings.appleReminderLinks[task.id] = reminderId`, then attempts to delete the vault task line.

Required note behavior:

1. Parse the current vault task and find notes linked to its vault relationship key.
2. Create the Apple Reminder.
3. Update linked notes:
   - add `task:apple-reminders:{reminderId}` to `taskhub-related`;
   - move or copy the old vault key into `taskhub-related-history`;
   - update `taskhub-updated`;
   - preserve all unrelated YAML fields.
4. Save `appleReminderLinks`.
5. Delete the source vault task line as today.
6. Reindex notes and tasks, then refresh views.

If note YAML update fails after the Apple Reminder is created, Task Hub should not delete the source task line. It should save the Apple Reminder link if possible and show a notice explaining that note transfer needs repair. This avoids silently orphaning notes.

### Apple Reminder to Apple Calendar Conversion

The first version can preserve notes by adding the new event key and retaining the old reminder key in history. This is less urgent than vault-task send, but should be designed in the same service so conversion paths do not diverge.

### Apple Calendar Event to Reminder Conversion

Same principle: add the new reminder key, keep the old event key in history. If the source event is deleted after conversion, history keeps the user-facing trail.

## Indexing and Performance

- Add a lightweight note index separate from `TaskIndex`.
- Scan only Markdown files, skipping `ignoredPaths`.
- Use Obsidian metadata cache when available for frontmatter reads; fall back to file reads only when needed.
- Cache by file path, mtime, and size, mirroring the task index pattern.
- Reindex a note immediately after Task Hub creates or updates it.
- Rebuild note counts from indexed relationships, not by scanning all notes during every render.

## YAML Update Rules

- Preserve existing frontmatter keys and note body.
- Do not reorder unrelated user properties.
- If no frontmatter exists, insert one at the top.
- If malformed frontmatter exists, fail with a clear notice instead of rewriting the file.
- Use arrays for `taskhub-related`, `taskhub-related-history`, and `tags`.
- Do not duplicate relationship keys.
- Never mutate Thino `id` or `createdAt` after note creation.

## File Naming

Task Hub note default filename:

```text
Task Hub Notes/YYYY-MM-DD HHmmss - {safe task or event title}.md
```

Thino multi-file default filename:

```text
Thino/YYYYMMDDHHmmss.md
```

Sanitize illegal path characters and enforce conservative filename length. Thino docs warn against illegal characters and long paths, so Task Hub should apply the same caution.

## Acceptance Criteria

- With task notes disabled, no note menu items, note counts, or note containers appear.
- With task notes enabled, right-clicking a vault task can create a linked Markdown note.
- The created note has valid YAML frontmatter and is opened when `openNoteAfterCreate` is enabled.
- Selecting a task with one or more notes shows the notes container; selecting a task with none hides it.
- Task rows with notes show the correct count; rows without notes show no count badge.
- Right-clicking an event can create a local linked note without modifying the external event.
- Thino mode creates a multi-file-style Markdown note with `id`, `createdAt`, and Task Hub relationship fields.
- Updating a Task Hub-created Thino note never rewrites `id` or `createdAt`.
- Sending a vault task to Apple Reminders updates linked note YAML to include the new Apple Reminder relationship.
- If note transfer fails during send, the vault task is not deleted.
- Existing task parsing, filtering, calendar rendering, and Apple Reminders send tests still pass.

## Test Plan

Unit tests:

- relationship key generation for vault tasks, Apple reminders, ICS events, and Apple Calendar events.
- frontmatter insert/update behavior.
- malformed frontmatter conflict behavior.
- note index count aggregation.
- Thino note creation metadata.
- send-to-Apple-Reminders note transfer ordering.

View tests:

- task row count badge hidden/shown correctly.
- task detail note container hidden/shown correctly.
- task right-click menu includes note action only when enabled.
- calendar context menu includes note action only when enabled.
- calendar details show note links when present.

Settings tests:

- defaults normalize correctly.
- old settings load with task notes disabled.
- all new user-facing strings have English and Chinese translations.

Manual test in `/Users/carlos/Coding/testValut`:

- enable task notes, create note from vault task, verify YAML and detail display.
- create note from Apple Reminder task, verify no external write occurs.
- create note from Apple Calendar event and ICS event, verify local note only.
- enable Thino mode, create note, reload Obsidian/Thino, verify Thino can see it if configured for multi-file mode.
- send a vault task with linked notes to Apple Reminders, verify old task is removed and notes now point to the reminder.

## Risks and Mitigations

- Relationship keys based on vault line numbers can drift when the source file changes. Mitigation: include a line hash and preserve history; later versions can add inline hidden task IDs if needed.
- YAML parsing can damage user metadata if done with string hacks. Mitigation: use Obsidian metadata where possible and a focused frontmatter utility with tests; fail on malformed YAML.
- Thino compatibility may vary by version and Pro settings. Mitigation: label it as Thino multi-file compatible, keep the folder configurable, and avoid rewriting Thino-owned fields.
- External event IDs may not be stable across all ICS feeds. Mitigation: include source id and start date in the key, and keep display fallback metadata in note body or history.
- Apple Reminder send is not transactional across EventKit and vault writes. Mitigation: perform note YAML transfer before deleting the source task, and keep repairable history.

## Recommended Implementation Plan After Approval

1. Add data types, defaults, settings normalization, and i18n strings.
2. Implement relationship key and frontmatter utilities with tests.
3. Implement note creation and note index service with tests.
4. Wire task list UI: context menu, count badge, detail note container.
5. Wire calendar UI: context menu and detail note container.
6. Integrate send/conversion relationship transfer paths.
7. Add focused tests for settings, note index, UI visibility, and send migration.
8. Run `npm test`, `npm run typecheck`, `npm run build`, then sync to the test vault for manual verification.

## Open Decisions Before Coding

- Whether the default note should open automatically after creation. Proposed default: yes.
- Whether "Add note" should always create a new note or first offer linking an existing note. Proposed first version: create new only.
- Whether note counts should include history-only links. Proposed first version: count current links only; show history only for repair/debug paths.
- Whether to support Thino diary mode later. Proposed answer: not in this feature; it needs a separate design because it is not YAML-frontmatter-per-note.
