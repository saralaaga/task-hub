#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BRIDGE_VERSION = 1;
const DEFAULT_BRIDGE_FOLDER = ".taskhub-agent";
const DEFAULT_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 250;

const TOOL_DEFINITIONS = [
  tool("taskhub_capabilities", "Return Task Hub bridge/API capabilities.", {}),
  tool("taskhub_list_tasks", "List Task Hub tasks with optional filters.", {
    status: enumSchema(["open", "completed", "all"]),
    source: enumSchema(["vault", "apple-reminders", "dida"]),
    date: stringSchema("YYYY-MM-DD"),
    tags: arraySchema(stringSchema("Tag, with or without leading #")),
    text: stringSchema("Case-insensitive text query")
  }),
  tool("taskhub_get_task", "Get one Task Hub task by stableId.", {
    stableId: requiredStringSchema("Task stableId")
  }, ["stableId"]),
  tool("taskhub_create_task", "Create a Task Hub task through Task Hub settings and safe writers.", {
    title: requiredStringSchema("Task title"),
    date: stringSchema("YYYY-MM-DD; omit for unscheduled"),
    startMinutes: numberSchema("Minutes after midnight"),
    tags: arraySchema(stringSchema("Tag, with or without leading #")),
    notes: stringSchema("Optional notes for external task targets"),
    recurrence: stringSchema("Optional RRULE repeat string"),
    target: objectSchema({
      type: enumSchema(["vault", "apple-reminders", "dida"]),
      listId: stringSchema("Apple Reminders list id"),
      projectId: stringSchema("Dida project id")
    })
  }, ["title"]),
  tool("taskhub_complete_task", "Mark a task complete by stableId.", {
    stableId: requiredStringSchema("Task stableId")
  }, ["stableId"]),
  tool("taskhub_reopen_task", "Mark a completed task open by stableId.", {
    stableId: requiredStringSchema("Task stableId")
  }, ["stableId"]),
  tool("taskhub_list_notes", "List Task Hub Hub Notes.", {}),
  tool("taskhub_create_note", "Create a dated Task Hub note. Omits date to use today inside Task Hub.", {
    date: stringSchema("YYYY-MM-DD"),
    body: stringSchema("Note body")
  }),
  tool("taskhub_create_dated_note", "Create a Task Hub note for an explicit date.", {
    date: requiredStringSchema("YYYY-MM-DD"),
    body: stringSchema("Note body")
  }, ["date"]),
  tool("taskhub_create_task_note", "Create a task-linked Hub Note by task stableId.", {
    taskStableId: requiredStringSchema("Task stableId"),
    body: stringSchema("Note body")
  }, ["taskStableId"]),
  tool("taskhub_list_task_notes", "List Hub Notes linked to a task stableId.", {
    taskStableId: requiredStringSchema("Task stableId")
  }, ["taskStableId"])
];

const TOOL_ACTIONS = {
  taskhub_capabilities: "capabilities",
  taskhub_list_tasks: "listTasks",
  taskhub_get_task: "getTask",
  taskhub_create_task: "createTask",
  taskhub_complete_task: "completeTask",
  taskhub_reopen_task: "reopenTask",
  taskhub_list_notes: "listNotes",
  taskhub_create_note: "createNote",
  taskhub_create_dated_note: "createDatedNote",
  taskhub_create_task_note: "createTaskNote",
  taskhub_list_task_notes: "listTaskNotes"
};

function tool(name, description, properties, required = []) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      additionalProperties: false,
      ...(required.length > 0 ? { required } : {})
    }
  };
}

function stringSchema(description) {
  return { type: "string", description };
}

function requiredStringSchema(description) {
  return stringSchema(description);
}

function numberSchema(description) {
  return { type: "number", description };
}

function arraySchema(items) {
  return { type: "array", items };
}

function enumSchema(values) {
  return { type: "string", enum: values };
}

function objectSchema(properties) {
  return { type: "object", properties, additionalProperties: false };
}

function normalizeVaultPath(input) {
  return String(input || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+/u, "")
    .replace(/^\.\//u, "")
    .replace(/\/$/u, "");
}

function bridgePaths(options = {}) {
  const vaultPath = options.vaultPath || process.env.TASKHUB_VAULT_PATH;
  if (!vaultPath) {
    throw new Error("TASKHUB_VAULT_PATH is required.");
  }
  const bridgeFolder = normalizeVaultPath(options.bridgeFolder || process.env.TASKHUB_BRIDGE_FOLDER || DEFAULT_BRIDGE_FOLDER);
  const root = path.resolve(vaultPath, bridgeFolder);
  return {
    vaultPath: path.resolve(vaultPath),
    bridgeFolder,
    requests: path.join(root, "requests"),
    responses: path.join(root, "responses")
  };
}

function createRequestId(action) {
  return `mcp-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function callBridgeAction(action, payload = {}, options = {}) {
  const paths = bridgePaths(options);
  const timeoutMs = Number(options.timeoutMs || process.env.TASKHUB_BRIDGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const requestId = options.requestId || createRequestId(action);
  const request = {
    version: BRIDGE_VERSION,
    requestId,
    action,
    payload
  };
  fs.mkdirSync(paths.requests, { recursive: true });
  fs.mkdirSync(paths.responses, { recursive: true });
  const requestPath = path.join(paths.requests, `${safeFileName(requestId)}.json`);
  const responsePath = path.join(paths.responses, `${safeFileName(requestId)}.json`);
  if (fs.existsSync(responsePath)) {
    throw new Error(`Refusing to reuse requestId with existing response: ${requestId}`);
  }
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  return waitForBridgeResponse(responsePath, timeoutMs);
}

function waitForBridgeResponse(responsePath, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(responsePath)) {
        try {
          resolve(JSON.parse(fs.readFileSync(responsePath, "utf8")));
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for Task Hub bridge response: ${responsePath}`));
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
  });
}

function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 120) || "request";
}

async function handleJsonRpc(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: message.params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "taskhub-mcp-server", version: "1.0.0" }
    };
  }
  if (message.method === "tools/list") {
    return { tools: TOOL_DEFINITIONS };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    const action = TOOL_ACTIONS[name];
    if (!action) throw new Error(`Unknown tool: ${name}`);
    const response = await callBridgeAction(action, message.params?.arguments || {});
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      isError: response.ok === false
    };
  }
  if (message.method === "ping") {
    return {};
  }
  if (message.method?.startsWith("notifications/")) {
    return undefined;
  }
  throw new Error(`Unsupported method: ${message.method}`);
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function writeResult(id, result) {
  if (id === undefined || result === undefined) return;
  writeMessage({ jsonrpc: "2.0", id, result });
}

function writeError(id, error) {
  if (id === undefined) return;
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error instanceof Error ? error.message : String(error)
    }
  });
}

function startServer() {
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/iu);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) return;
      const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
      buffer = buffer.slice(bodyEnd);
      void Promise.resolve()
        .then(() => JSON.parse(body))
        .then(async (message) => {
          const result = await handleJsonRpc(message);
          writeResult(message.id, result);
        })
        .catch((error) => {
          try {
            const message = JSON.parse(body);
            writeError(message.id, error);
          } catch {
            writeError(null, error);
          }
        });
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  TOOL_DEFINITIONS,
  TOOL_ACTIONS,
  bridgePaths,
  callBridgeAction,
  handleJsonRpc,
  normalizeVaultPath,
  safeFileName
};
