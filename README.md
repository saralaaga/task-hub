# Task Hub

[中文文档](README.zh-CN.md)

Task Hub is a desktop-only Obsidian plugin that brings scattered Markdown tasks into one focused workspace. It indexes tasks across your vault and presents them in task, calendar, and tag views, so you can review commitments without leaving your notes.

![Task Hub calendar overview](assets/task-hub-calendar-overview.png)

## Compatibility

- **Obsidian:** Task Hub is a desktop-only plugin and declares `minAppVersion` `1.5.0` in `manifest.json`. Use Obsidian desktop 1.5.0 or later.
- **Mobile:** Obsidian mobile is not supported.
- **Local Apple integration:** Apple Reminders and Apple Calendar integration is macOS-only and is supported on macOS 14 Sonoma or later. The helper contains a legacy EventKit permission path for older macOS releases, but macOS 13 and earlier are not part of the current tested support matrix.
- **Other desktop systems:** Core vault task, tag, calendar, and public ICS features are designed for Obsidian desktop. Apple Reminders and Apple Calendar features are unavailable outside macOS.

## Features

- Index Markdown tasks written as `- [ ]` and `- [x]`.
- Open the source note from a task and jump near the original line.
- Safely complete vault tasks after verifying that the source line still matches the indexed task.
- Browse tasks in task, calendar, and tag views.
- Filter by completion state, source, tags, date bucket, text, and custom AND/OR conditions.
- Extract due dates written as `📅 YYYY-MM-DD` or `due:: YYYY-MM-DD`.
- Show dated tasks and external events in day, week, and month calendar views.
- Reschedule vault Markdown tasks, Apple Reminders, and Apple Calendar events by dragging calendar cards to another day when the matching writeback option is enabled.
- Sync Dida/TickTick tasks through the Open API, with optional create, edit, complete, delete, color, and drag-reschedule controls.
- Add read-only public ICS calendar sources.
- Read iCloud-synced Apple Reminders and Apple Calendar data on macOS desktop through the local Apple helper.
- Explicitly send a vault Markdown task to Apple Reminders from the editor context menu, the command palette, a user-assigned hotkey, or Task Hub task details when reminder creation is enabled.
- Create local Markdown notes linked to tasks and calendar events. Linked notes are tracked with YAML frontmatter, shown in the task or event details panel, and counted on task rows when notes exist.
- Optionally create notes that are compatible with [Thino](https://github.com/Quorafind/Obsidian-Thino) multi-file storage.
- Switch between English and Chinese from the plugin settings.

## Usage

After enabling Task Hub, use the ribbon icon or the command **Open Task Hub** to open the workspace.

The task view shows vault tasks and supported external task sources in one list. Use the left sidebar to narrow tasks by source or tag. Use the top toolbar to show or hide completed tasks, apply condition filters, search by text, or rescan the vault.

When Local Apple and Apple Reminders are enabled, the separate **Create Apple Reminders from vault tasks** setting allows one-at-a-time export from vault Markdown tasks. Use the editor right-click menu on a task line, the command **Send current task to Apple Reminders**, an Obsidian hotkey assigned to that command, or the Task Hub task detail action.

When Dida integration is enabled, Task Hub can read Dida/TickTick tasks through the configured API token. Separate settings control task creation, edit/complete writeback, drag rescheduling, deletion, default list, default reminder offset, and per-list colors. Sending a vault Markdown task to Dida is explicit; Task Hub creates the external task first and then removes the source Markdown line.

The calendar view combines dated tasks, public ICS events, Apple Calendar events, and dated Apple Reminders where available. You can switch between month, week, and day layouts. Drag a vault Markdown task card to another day to update its existing `📅 YYYY-MM-DD` or `due:: YYYY-MM-DD` date. When the matching writeback options are enabled, dated Apple Reminder cards and Apple Calendar event cards can also be dragged to change their date.

The tag view groups indexed tasks by tag and lets you drill into a tag's related tasks.

## External Source Support Matrix

| Capability | Apple Calendar | Apple Reminders | Dida / TickTick |
| --- | --- | --- | --- |
| Platform / backend | macOS desktop local helper | macOS desktop local helper | Open API over HTTPS |
| Read into Task Hub | Yes: events | Yes: reminders | Yes: tasks, including inbox |
| Create from Task Hub | Yes: calendar events when Apple Calendar task sending is enabled | Yes: reminders when reminder creation is enabled | Yes: tasks when Dida creation is enabled |
| Edit title / notes | Yes, when Apple Calendar writeback is enabled | Yes, when reminder writeback is enabled | Yes, when Dida writeback is enabled |
| Complete / reopen | Not applicable to events | Yes, when reminder writeback is enabled | Yes, when Dida writeback is enabled |
| Drag reschedule | Yes, when Apple Calendar writeback is enabled | Yes, when reminder writeback and drag controls are enabled | Yes, when Dida writeback and drag controls are enabled |
| Move between lists / calendars | Calendar selection is available for edited events where writable calendars are loaded | Yes, when reminder creation/writeback controls are enabled | Yes, when Dida writeback is enabled |
| Delete external item | No | No | Yes, when Dida deletion is enabled |
| Send vault Markdown task to external source | No direct send; use calendar event creation from the calendar UI | Yes, explicit send action after enabling creation | Yes, explicit send action after enabling creation |
| Tag read | Not applicable | Yes, through reminder title hashtags | Yes, native Dida `tags` field maps to Task Hub hashtags |
| Tag write | Not applicable | Yes, as Apple-compatible title hashtags when reminder tag creation is enabled | Yes, as native Dida task tags when native tag sync is enabled |
| Date / time write | Yes: event date/time | Yes: reminder due date/time where available | Yes: task date/time and reminders |
| Recurrence | Read/write is limited; dragged recurring events are saved as the dragged occurrence only | Read display only where available | Preserved when present in synced task payloads; full recurrence editing is not a first-class UI yet |

## Task Notes

Task notes are optional local Markdown notes linked to Task Hub tasks or calendar events. When task notes are enabled, right-click a task or calendar item and choose **Create linked note**. Task Hub writes the relationship into the note's YAML frontmatter, then shows related note content in a separate notes container in task or event details. The task list can also show a note count in the upper-right corner of task rows.

Note cards are read in place. Use the three-dot menu on a note card to delete the note, edit it in a Task Hub modal, or open it as a Thino note when the Thino multi-file option is enabled.

Task Hub can create regular Task Hub notes or Thino multi-file-compatible notes. The Thino option is intentionally limited to [Thino](https://github.com/Quorafind/Obsidian-Thino) multi-file storage because that mode stores each memo as a separate Markdown file with YAML frontmatter. Thino single-file, Canvas, and diary storage are not generated or modified by Task Hub.

When a vault Markdown task is sent to Apple Reminders, Task Hub updates linked note frontmatter before deleting the original task line, so the notes remain associated with the newly created Apple Reminder.

## iCloud Reminders and Calendar

Task Hub integrates with Apple's local Reminders and Calendar databases on macOS. If your Mac is signed in to iCloud and Reminders/Calendar syncing is enabled, Task Hub can show the same iCloud-backed reminders and events that appear in the native Apple apps. Task Hub does not connect to iCloud.com or ask for your Apple ID password; macOS handles account sync and permissions locally.

Apple Reminders support includes reading reminder title, list, completion state, notes, URL, and due date. When Apple Reminders writeback is enabled in settings, Task Hub can mark reminders complete or open, and can reschedule dated reminders by dragging them in the calendar. Vault Markdown tasks can also be explicitly sent to Apple Reminders when reminder creation is enabled.

Apple Calendar support includes reading local/iCloud calendar events into the Task Hub calendar with title, calendar name, start/end time, all-day state, location, notes, and URL where available. When Apple Calendar writeback is enabled in settings, Task Hub can reschedule events by dragging them to another day while preserving the event's time, duration, and all-day state. Recurring events are saved as the dragged occurrence only.

## Current Scope

Task Hub intentionally keeps the first releases conservative:

- Vault Markdown tasks can be completed from Task Hub.
- Vault Markdown tasks with an existing supported date can be rescheduled from the calendar.
- Vault Markdown tasks can be sent to Apple Reminders only by explicit user action, and Task Hub records the created reminder id to avoid duplicate sends.
- Vault Markdown tasks can be sent to Dida only by explicit user action, and Task Hub records the created Dida task id to avoid duplicate sends.
- Task notes are local Markdown files. Thino integration is limited to Thino multi-file-compatible notes; Thino single-file, Canvas, and diary storage are outside the current scope.
- Apple Reminders completion and date writeback are optional and must be enabled in settings.
- Dida completion, editing, drag rescheduling, creation, deletion, and native tag sync are optional and must be enabled independently in settings. Dida API tokens are stored in Obsidian plugin data; use a test account or rotate tokens after development.
- Public ICS events are read-only. Apple Calendar event date writeback is available only when you explicitly enable it in Local Apple settings.
- Full Obsidian Tasks plugin grammar is not implemented.
- Timed Markdown task syntax, Google Calendar OAuth, Microsoft Calendar OAuth, and mobile support are not included yet.

## Privacy

Task Hub indexes Markdown files inside your local vault and stores plugin settings in your vault's Obsidian plugin data. Public ICS sources are fetched only from URLs you configure. Dida/TickTick integration sends authenticated HTTPS requests only to the configured API base. Local Apple integration runs only on macOS desktop and asks macOS for Reminders or Calendar access before reading local data. iCloud Reminders and Calendar data stay mediated by Apple's local sync services; Task Hub does not talk directly to iCloud servers.

Task Hub does not send vault tasks to a remote service.

## Why These Permissions?

Obsidian's plugin review may show several capability warnings. Task Hub uses them for these narrow reasons:

- **Vault enumeration:** Task Hub scans Markdown files in your vault to find task lines and date tokens.
- **Vault read/write:** Task Hub reads individual notes for indexing and only writes back when you complete, delete, edit, or reschedule a supported task. Markdown task writeback checks that the original source line still matches before changing it.
- **Filesystem access:** The plugin checks and installs the optional bundled Local Apple helper inside its own plugin folder on macOS desktop.
- **Shell execution:** The plugin launches only the bundled `taskhub-apple-helper` binary for optional Apple Reminders and Apple Calendar integration. The helper asks macOS for local Reminders/Calendar permission and does not ask for your Apple ID.
- **Network requests:** Task Hub fetches only the public ICS calendar URLs you configure and the configured Dida/TickTick Open API when enabled.

## Installation

When Task Hub is published in the Obsidian community plugin directory, install it from **Settings -> Community plugins -> Browse**.

For manual installation from a GitHub release:

1. Download `manifest.json`, `main.js`, and `styles.css` from the latest release.
2. Create this folder in your vault: `.obsidian/plugins/task-hub/`.
3. Copy the downloaded files into that folder.
4. Restart Obsidian or reload community plugins, then enable **Task Hub**.

Local Apple Reminders and Apple Calendar support depends on the bundled `taskhub-apple-helper` binary inside the plugin package. GitHub release assets are kept to Obsidian's supported files (`main.js`, `manifest.json`, and `styles.css`); helper distribution is handled by the plugin package/source build path rather than as an extra release asset.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Useful commands:

```bash
npm run dev
npm run dev:hot
npm run smoke
npm run check:apple-helper
npm run diagnose:apple
```

Build the optional Apple helper on macOS:

```bash
npm run build:apple-helper
```

## Release Assets

For an Obsidian community plugin release, the GitHub release tag must match `manifest.json`'s `version` exactly and include these binary attachments:

- `main.js`
- `manifest.json`
- `styles.css`

The repository root also keeps the files expected by the Obsidian submission flow:

- `README.md`
- `LICENSE`
- `manifest.json`
- `versions.json`

Do not attach extra files such as `taskhub-apple-helper` to community-plugin GitHub releases. Obsidian only downloads `main.js`, `manifest.json`, and `styles.css` from release assets.
