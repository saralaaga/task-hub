# Task Hub Agent Usage Examples and Safety

## Create a task

User asks: "Create a task for today to send the quote, tag client/acme."

Procedure:

1. Send `capabilities`.
2. Confirm `tasks.createVault` is true.
3. Send `createTask` with a concrete ISO date and tag.
4. Report the returned `stableId` if present.

Do not append a Markdown checkbox line manually.

## Complete a task

User asks: "Mark the quote task done."

Procedure:

1. Use `listTasks` or `getTask` to find the task.
2. Use `completeTask` with the returned `stableId`.
3. If the response is `conflict`, report that Task Hub could not safely identify the source line.

Do not patch the source Markdown line after a conflict.

## Create a dated note

User asks: "Create today's Task Hub note with this meeting summary."

Procedure:

1. Send `capabilities`.
2. Confirm `notes.createDated` is true.
3. Send `createDatedNote` or `createNote`.

Task Hub writes the Hub Note frontmatter. Do not generate `taskhub-note-id` yourself.

## Create a task-linked note

User asks: "Add this context to the proposal task."

Procedure:

1. Find the task and capture `stableId`.
2. Confirm `notes.createTaskNote` is true.
3. Send `createTaskNote` with `taskStableId` and `body`.

Do not invent `taskhub-related`; Task Hub resolves the correct relationship key.

## Handling disabled capabilities

If a response has `capability_disabled`, stop that operation and explain which Task Hub setting must be enabled. Do not use a fallback direct file edit unless the user explicitly asks for raw Markdown editing and accepts that it bypasses Task Hub semantics.

## Handling repeated requests

Use unique `requestId` values. Task Hub writes one response per request ID and skips processing if a response already exists, which prevents duplicate task creation after file watcher retries.
