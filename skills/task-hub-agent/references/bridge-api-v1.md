# Task Hub Agent Bridge API v1

## MCP server

This repository includes a stdio MCP server:

```text
mcp/taskhub-mcp-server.cjs
```

Configure it with:

```text
TASKHUB_VAULT_PATH=/absolute/path/to/vault
TASKHUB_BRIDGE_FOLDER=.taskhub-agent
```

Available MCP tools:

- `taskhub_capabilities`
- `taskhub_list_tasks`
- `taskhub_get_task`
- `taskhub_create_task`
- `taskhub_complete_task`
- `taskhub_reopen_task`
- `taskhub_list_notes`
- `taskhub_create_note`
- `taskhub_create_dated_note`
- `taskhub_create_task_note`
- `taskhub_list_task_notes`

Use MCP tools when they are available. The bridge JSON format below is the fallback transport and is also what the MCP server writes internally.

Bridge requests are JSON files written to:

```text
<bridge-folder>/requests/<requestId>.json
```

Responses are written by Task Hub to:

```text
<bridge-folder>/responses/<requestId>.json
```

Default bridge folder:

```text
.taskhub-agent
```

## Request envelope

```json
{
  "version": 1,
  "requestId": "req-20260722-001",
  "action": "listTasks",
  "payload": {}
}
```

## Response envelope

Success:

```json
{
  "version": 1,
  "requestId": "req-20260722-001",
  "ok": true,
  "data": {}
}
```

Failure:

```json
{
  "version": 1,
  "requestId": "req-20260722-001",
  "ok": false,
  "error": {
    "code": "conflict",
    "message": "The indexed task line no longer matches the file."
  }
}
```

Error codes:

- `validation_error`
- `not_found`
- `conflict`
- `capability_disabled`
- `operation_failed`

## Actions

### capabilities

```json
{ "version": 1, "requestId": "req-cap", "action": "capabilities" }
```

Use this before write operations.

### listTasks

```json
{
  "version": 1,
  "requestId": "req-list",
  "action": "listTasks",
  "payload": {
    "status": "open",
    "date": "2026-07-22",
    "tags": ["#work"],
    "source": "vault",
    "text": "proposal"
  }
}
```

All filters are optional. `status` can be `open`, `completed`, or `all`.

### getTask

```json
{
  "version": 1,
  "requestId": "req-get",
  "action": "getTask",
  "payload": { "stableId": "vault:th_..." }
}
```

### createTask

```json
{
  "version": 1,
  "requestId": "req-create-task",
  "action": "createTask",
  "payload": {
    "title": "Send quote",
    "date": "2026-07-22",
    "startMinutes": 570,
    "tags": ["#client/acme"],
    "notes": "Bring prior pricing notes.",
    "target": { "type": "vault" }
  }
}
```

If `date` is omitted, Task Hub creates an unscheduled task. `target` defaults to `{ "type": "vault" }`.

### completeTask / reopenTask

```json
{
  "version": 1,
  "requestId": "req-complete",
  "action": "completeTask",
  "payload": { "stableId": "vault:th_..." }
}
```

Use `reopenTask` with the same payload to mark a completed task open.

### listNotes

```json
{ "version": 1, "requestId": "req-notes", "action": "listNotes" }
```

### createNote

```json
{
  "version": 1,
  "requestId": "req-create-note",
  "action": "createNote",
  "payload": {
    "date": "2026-07-22",
    "body": "Meeting summary..."
  }
}
```

If `date` is omitted, Task Hub uses today.

### createDatedNote

```json
{
  "version": 1,
  "requestId": "req-create-dated-note",
  "action": "createDatedNote",
  "payload": {
    "date": "2026-07-22",
    "body": "Standalone note body."
  }
}
```

### createTaskNote

```json
{
  "version": 1,
  "requestId": "req-create-task-note",
  "action": "createTaskNote",
  "payload": {
    "taskStableId": "vault:th_...",
    "body": "Task context."
  }
}
```

### listTaskNotes

```json
{
  "version": 1,
  "requestId": "req-list-task-notes",
  "action": "listTaskNotes",
  "payload": { "taskStableId": "vault:th_..." }
}
```
