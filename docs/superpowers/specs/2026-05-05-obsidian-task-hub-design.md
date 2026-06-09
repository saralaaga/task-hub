# Obsidian Task Hub Design

Date: 2026-05-05
Status: Draft for review

## Purpose

Build an Obsidian plugin that gathers Markdown tasks scattered across a vault into a useful task hub. The first version should make tasks discoverable, filterable, calendar-aware, tag-aware, and easy to jump back to in the original note.

The plugin should start as one primary dashboard, while keeping the internal view boundaries clean enough that Calendar and Tags can later become independent Obsidian panes.

## Goals

- Show all Markdown tasks from the current vault in one interface.
- Support precise click-through from a task to the source note line.
- Group the main task view by time/status: overdue, today, this week, future, and no date.
- Support day, week, and month calendar browsing for dated tasks.
- Support tag statistics and tag-based drilldown.
- Support simple task filtering by status, date, tag, source, and text.
- Support completing a Markdown task from inside the plugin.
- Support multiple read-only public ICS calendar sources with colors and layer toggles.
- Keep indexing responsive on large vaults through caching, incremental updates, and time-sliced scanning.

## Non-goals for Version 1

- Full compatibility with the Obsidian Tasks plugin syntax.
- Google Calendar or Microsoft Calendar OAuth.
- Creating or editing external calendar events.
- Full task editing inside the dashboard.
- Saved filter views.
- Recurring tasks, priority workflows, or complete productivity analytics.
- A standalone source-note grouping view.

## Interface Approach

Use a hybrid dashboard/pane architecture.

Version 1 ships one main `Task Hub` dashboard. Inside the dashboard, users switch between Tasks, Calendar, and Tags. Each view should be implemented as a separate module so it can later be registered as an independent pane.

### Main Layout

```text
Task Hub
├── Top Bar
│   ├── View Switch: Tasks / Calendar / Tags
│   ├── Search
│   ├── Rescan
│   └── Settings
├── Left Sidebar
│   ├── Status: Open / Completed / All
│   ├── Date: Overdue / Today / This Week / This Month / No Date / Custom
│   ├── Tags
│   ├── Source: Folder / File
│   └── Calendar Layers: Vault Tasks + ICS Sources
├── Main Content
│   ├── Tasks View
│   ├── Calendar View
│   └── Tags View
└── Detail Panel
    ├── Task metadata
    ├── Source note and heading
    ├── Nearby context
    ├── Jump to task
    └── Complete checkbox
```

### Responsive Behavior

- Wide pane: three columns, using sidebar, main content, and detail panel.
- Medium pane: two columns, using sidebar and main content; details open inline or in a modal.
- Narrow pane: single column; filters collapse behind a button and details open as a focused panel.

## Views

### Tasks View

The Tasks view is the default homepage.

Default groups:

- Overdue
- Today
- This week
- Future
- No date

Completed tasks are hidden by default. Users can switch the status filter to Completed or All.

Each task row should show:

- Checkbox
- Task text
- Due date, when present
- Tags
- Source file
- Optional source heading

Clicking a task opens the source Markdown file and jumps to the task line. The data model still stores heading and context preview so a richer detail panel can be improved later.

### Calendar View

The Calendar view supports:

- Day view
- Week view
- Month view

Dated vault tasks and ICS events appear in the same calendar, separated by color or icon. Users can toggle layers:

- Vault tasks
- Each enabled ICS source
- Completed tasks, if enabled by filter

Version 1 treats vault tasks as all-day date items. It does not support task time ranges. External ICS events should preserve all-day and time-range information.

Month view should control density by showing a small number of items per day plus a more affordance. Day and week views can show fuller item details.

### Tags View

The Tags view combines statistics and drilldown.

Version 1 tag statistics:

- Total tasks
- Open tasks
- Overdue tasks
- Tasks due this week

Clicking a tag opens a filtered task list for that tag. Multi-tag filtering belongs to the shared filter model and can be used from the sidebar.

## Filtering

Version 1 supports simple combined filters:

- Status: Open, Completed, All
- Date: Overdue, Today, This week, This month, No date, Custom range
- Tags: multi-select
- Source: folder and file search
- Text: task content keyword search
- Calendar layers: Vault tasks and individual ICS sources

Saved filter views are reserved for a later release.

## Task Parsing

Version 1 parses standard Markdown task lines:

```md
- [ ] Write client proposal #client/acme 📅 2026-05-10
- [x] Send invoice #finance
```

Supported task states:

- `- [ ]`
- `- [x]`

Supported tag syntax:

- Obsidian-style inline tags such as `#project/a`

Supported due-date syntax:

- `📅 YYYY-MM-DD`
- `due:: YYYY-MM-DD`
- `YYYY-MM-DD`

The parser should preserve fields for future compatibility, but not parse the full Obsidian Tasks plugin grammar in version 1.

## Data Model

### TaskItem

```ts
type TaskItem = {
  id: string;
  filePath: string;
  line: number;
  rawLine: string;
  text: string;
  completed: boolean;
  tags: string[];
  dueDate?: string;
  heading?: string;
  contextPreview?: string;
  source: "vault";

  scheduledDate?: string;
  startDate?: string;
  priority?: string;
  recurrence?: string;
  createdDate?: string;
  completedDate?: string;
};
```

Task IDs should be stable enough for UI selection and cache diffing, but not treated as permanent database IDs. Version 1 can generate IDs from `filePath + line + normalized raw line hash`.

### CalendarEvent

```ts
type CalendarEvent = {
  id: string;
  sourceId: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  url?: string;
};
```

### CalendarSource

```ts
type CalendarSource = {
  id: string;
  name: string;
  type: "ics";
  url: string;
  color: string;
  enabled: boolean;
  refreshIntervalMinutes: number;
  status: CalendarSourceStatus;
};
```

### CalendarSourceStatus

```ts
type CalendarSourceStatus =
  | {
      state: "ok";
      lastSyncedAt: string;
      eventCount: number;
    }
  | {
      state: "error";
      errorType:
        | "network_error"
        | "http_error"
        | "invalid_content"
        | "parse_error";
      message: string;
      statusCode?: number;
      lastAttemptAt: string;
      lastSuccessfulSyncAt?: string;
    }
  | {
      state: "never";
    };
```

## Safe Completion Toggle

The source Markdown file remains the source of truth.

When a user completes a task from Task Hub:

1. Read the current file content.
2. Check whether the indexed line still matches the indexed task.
3. If it matches, replace `- [ ]` with `- [x]`.
4. If the line changed, search a small nearby window for the same raw task.
5. If no safe match is found, do not write. Show a clear rescan or conflict message.

Use Obsidian's file APIs for modification. Prefer an atomic read-modify-write path when available.

## Indexing and Performance

Large vaults must remain usable. The plugin should not block Obsidian by synchronously reading every note on startup.

Obsidian `TFile.stat` includes file stats such as:

- `ctime`: creation time in Unix milliseconds.
- `mtime`: last modification time in Unix milliseconds.
- file size.

Version 1 should use these stats for index invalidation.

### Indexed File State

```ts
type IndexedFileState = {
  path: string;
  ctime: number;
  mtime: number;
  size: number;
  taskIds: string[];
  lastIndexedAt: string;
  lastError?: string;
};
```

### Cold Start

On startup:

1. Call `app.vault.getMarkdownFiles()`.
2. Apply ignored-path filters.
3. Compare each file's `mtime` and size against the cached `IndexedFileState`.
4. Skip unchanged files.
5. Queue changed, new, and previously failed files for parsing.

### Time-Sliced Scanning

Scanning should be batched. Example defaults:

- Batch size: 20-50 Markdown files.
- Time budget per batch: 50-100 ms.
- Yield between batches so Obsidian can update UI.

The plugin should not use a hard "maximum scan time means done" rule, because that can silently omit tasks. Instead:

- Track queued, indexed, skipped, failed, and pending counts.
- Show indexing progress in the UI when indexing is active.
- Allow manual rescan.
- Let interrupted scans continue later using cache state.

### Incremental Updates

Listen to vault file events:

- `modify`: reparse the Markdown file.
- `create`: add and parse the new Markdown file.
- `delete`: remove tasks and file state for that file.
- `rename`: update path references and reparse if needed.

Metadata cache events may help with future enhancements, but version 1 task extraction should use file content as the source of truth.

## External ICS Calendars

Version 1 supports multiple public read-only ICS calendar sources.

Each source supports:

- Name
- URL
- Color
- Enabled/disabled
- Refresh interval
- Last sync status
- Last sync time
- Last error message

ICS fetch failure should be categorized:

- `network_error`: DNS failure, timeout, TLS failure, request exception.
- `http_error`: HTTP status outside the 2xx range.
- `invalid_content`: response is clearly not ICS, such as an HTML login page.
- `parse_error`: response was fetched but could not be parsed as iCalendar.

A valid `VCALENDAR` with zero events is a successful sync with `eventCount: 0`.

On failure, keep displaying the last successful cached events, but show the source as failed with the latest attempt time and error.

## Settings

Version 1 settings:

- Default view: Tasks, Calendar, or Tags.
- Week starts on: Monday or Sunday.
- Show completed tasks by default.
- Ignored paths.
- Index on startup.
- Rescan vault.
- Index status: indexed files, task count, last scan time, pending count, failed count.
- Supported syntax summary for task and due-date parsing.
- ICS sources: add, edit, remove, enable, disable, color, refresh interval.

Parser customization is not part of version 1.

## Acceptance Criteria

- The plugin scans Markdown files in the vault and extracts `- [ ]` and `- [x]` tasks.
- Extracted tasks include text, file path, line number, completion state, tags, due date, optional heading, and optional context preview.
- The main Tasks view defaults to open tasks grouped by overdue, today, this week, future, and no date.
- Completed tasks are hidden by default and can be shown through the status filter.
- Users can filter tasks by status, date, tag, source, and text.
- Clicking a task opens the source file and jumps to the task line.
- Users can safely mark an open Markdown task complete from the dashboard.
- The Calendar view supports day, week, and month browsing.
- Dated vault tasks appear on the calendar as all-day items.
- Multiple ICS sources can be added, colored, enabled, disabled, refreshed, and displayed as calendar layers.
- ICS sync failures are categorized and surfaced while preserving last successful cached events.
- The Tags view shows tag statistics and supports tag drilldown.
- The plugin avoids blocking Obsidian during large vault scans by using cached file stats, incremental updates, and time-sliced scanning.
- Vault file changes update the task index automatically.
- Users can manually rescan the vault.

## Long-Term Plan

- Register Calendar and Tags as independent Obsidian panes.
- Add an Obsidian Tasks plugin-compatible parser.
- Add saved filter views.
- Add richer task editing for text, date, and tags.
- Add time-range tasks.
- Add recurring tasks and priority handling.
- Add Google Calendar and Microsoft Calendar providers.
- Add completion history, completion rate, and review/trend views.
- Add advanced parser settings.

## Open Questions

- Whether the first implementation should use a plain DOM view or a bundled UI framework.
- Which calendar rendering library, if any, should be used.
- Whether task search should be simple substring matching or a more Obsidian-like query model.
- Exact visual design details for the dashboard, narrow panes, and calendar density controls.
