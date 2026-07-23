---
name: task-hub-agent
description: Use when an external agent needs to read, create, or update Task Hub tasks and Hub Notes in an Obsidian vault through the Task Hub agent bridge. Trigger for Task Hub task CRUD, dated note creation, task-linked note creation, bridge JSON requests, or any request to automate Task Hub without directly editing Markdown files.
---

# Task Hub Agent

Use Task Hub's agent bridge/API. Do not edit vault Markdown directly for task or Hub Note operations.

## Required workflow

1. Prefer MCP tools named `taskhub_*` when available.
2. Check capabilities first with `taskhub_capabilities` or bridge action `capabilities`.
3. Use `stableId` for task updates and task-note links.
4. If MCP tools are unavailable, send bridge JSON requests into `<bridge-folder>/requests/`.
5. Read the matching JSON response from `<bridge-folder>/responses/`.
6. Treat `conflict`, `capability_disabled`, and `not_found` as terminal for that operation unless the user provides new state.

The default bridge folder is `.taskhub-agent`.

## Supported operations

- Read: `listTasks`, `getTask`, `listNotes`, `listTaskNotes`
- Task writes: `createTask`, `completeTask`, `reopenTask`
- Note writes: `createNote`, `createDatedNote`, `createTaskNote`

For MCP setup, schemas, and request examples, read `references/bridge-api-v1.md`.

For realistic usage patterns and safety rules, read `references/examples-and-safety.md`.

## Hard rules

- Never invent `stableId`, `taskhub-note-id`, or Hub Note frontmatter.
- Never write `- [ ]` / `- [x]` task lines directly when Task Hub API can perform the operation.
- Never bypass Task Hub settings for Apple Reminders, Dida, or notes.
- Never retry a write after `conflict` by patching files manually.
