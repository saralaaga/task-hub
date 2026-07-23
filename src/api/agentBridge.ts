import type { TaskHubAgentBridgeSettings } from "../types";
import {
  TaskHubApiV1,
  type TaskHubApiError,
  type TaskHubApiResult,
  type TaskHubCreateNoteInput,
  type TaskHubCreateTaskInput,
  type TaskHubCreateTaskNoteInput,
  type TaskHubTaskQuery
} from "./taskHubApi";

export const TASK_HUB_AGENT_BRIDGE_VERSION = 1;

export type TaskHubAgentBridgeAction =
  | "capabilities"
  | "listTasks"
  | "getTask"
  | "createTask"
  | "completeTask"
  | "reopenTask"
  | "listNotes"
  | "createNote"
  | "createDatedNote"
  | "createTaskNote"
  | "listTaskNotes";

export type TaskHubAgentBridgeRequest = {
  version: 1;
  requestId: string;
  action: TaskHubAgentBridgeAction;
  payload?: unknown;
};

export type TaskHubAgentBridgeResponse =
  | {
      version: 1;
      requestId: string;
      ok: true;
      data: unknown;
    }
  | {
      version: 1;
      requestId: string;
      ok: false;
      error: TaskHubApiError;
    };

export function agentBridgeRequestsFolder(settings: Pick<TaskHubAgentBridgeSettings, "folder">): string {
  return `${normalizeAgentBridgeFolder(settings.folder)}/requests`;
}

export function agentBridgeResponsesFolder(settings: Pick<TaskHubAgentBridgeSettings, "folder">): string {
  return `${normalizeAgentBridgeFolder(settings.folder)}/responses`;
}

export function agentBridgeResponsePath(settings: Pick<TaskHubAgentBridgeSettings, "folder">, requestId: string): string {
  return `${agentBridgeResponsesFolder(settings)}/${safeRequestId(requestId)}.json`;
}

export function agentBridgeRequestPathsFromListing(settings: TaskHubAgentBridgeSettings, paths: string[]): string[] {
  return paths
    .map((path) => normalizeVaultPath(path))
    .filter((path) => isAgentBridgeRequestPath(settings, path))
    .sort((a, b) => a.localeCompare(b));
}

export function isAgentBridgeRequestPath(settings: TaskHubAgentBridgeSettings, path: string): boolean {
  if (!settings.enabled) return false;
  const requestsFolder = `${agentBridgeRequestsFolder(settings)}/`;
  return normalizeVaultPath(path).startsWith(requestsFolder) && path.toLowerCase().endsWith(".json");
}

export function parseAgentBridgeRequest(content: string, fallbackRequestId: string): TaskHubAgentBridgeRequest | TaskHubAgentBridgeResponse {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return bridgeError(fallbackRequestId, "validation_error", "Bridge request must be a JSON object.");
    }
    const record = parsed as Record<string, unknown>;
    const requestId = typeof record.requestId === "string" && record.requestId.trim() ? record.requestId.trim() : fallbackRequestId;
    if (record.version !== TASK_HUB_AGENT_BRIDGE_VERSION) {
      return bridgeError(requestId, "validation_error", "Unsupported bridge request version.");
    }
    if (typeof record.action !== "string" || !isBridgeAction(record.action)) {
      return bridgeError(requestId, "validation_error", "Unsupported bridge action.");
    }
    return {
      version: TASK_HUB_AGENT_BRIDGE_VERSION,
      requestId,
      action: record.action,
      payload: record.payload
    };
  } catch (error) {
    return bridgeError(fallbackRequestId, "validation_error", error instanceof Error ? error.message : String(error));
  }
}

export async function executeAgentBridgeRequest(
  api: TaskHubApiV1,
  request: TaskHubAgentBridgeRequest
): Promise<TaskHubAgentBridgeResponse> {
  let result: TaskHubApiResult<unknown>;
  try {
    result = await executeApiAction(api, request);
  } catch (error) {
    result = {
      ok: false,
      error: {
        code: "validation_error",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
  if (result.ok) {
    return {
      version: TASK_HUB_AGENT_BRIDGE_VERSION,
      requestId: request.requestId,
      ok: true,
      data: result.data
    };
  }
  return {
    version: TASK_HUB_AGENT_BRIDGE_VERSION,
    requestId: request.requestId,
    ok: false,
    error: result.error
  };
}

function executeApiAction(api: TaskHubApiV1, request: TaskHubAgentBridgeRequest): Promise<TaskHubApiResult<unknown>> | TaskHubApiResult<unknown> {
  switch (request.action) {
    case "capabilities":
      return { ok: true, data: api.capabilities() };
    case "listTasks":
      return api.listTasks(asObject<TaskHubTaskQuery>(request.payload));
    case "getTask":
      return api.getTask(requiredString(request.payload, "stableId"));
    case "createTask":
      return api.createTask(asObject<TaskHubCreateTaskInput>(request.payload));
    case "completeTask":
      return api.completeTask(requiredString(request.payload, "stableId"));
    case "reopenTask":
      return api.reopenTask(requiredString(request.payload, "stableId"));
    case "listNotes":
      return api.listNotes();
    case "createNote":
      return api.createNote(asObject<TaskHubCreateNoteInput>(request.payload));
    case "createDatedNote":
      return api.createDatedNote({
        date: requiredString(request.payload, "date"),
        body: optionalString(request.payload, "body")
      });
    case "createTaskNote":
      return api.createTaskNote(asObject<TaskHubCreateTaskNoteInput>(request.payload));
    case "listTaskNotes":
      return api.listTaskNotes(requiredString(request.payload, "taskStableId"));
  }
}

function bridgeError(requestId: string, code: TaskHubApiError["code"], message: string): TaskHubAgentBridgeResponse {
  return {
    version: TASK_HUB_AGENT_BRIDGE_VERSION,
    requestId,
    ok: false,
    error: { code, message }
  };
}

function isBridgeAction(action: string): action is TaskHubAgentBridgeAction {
  return [
    "capabilities",
    "listTasks",
    "getTask",
    "createTask",
    "completeTask",
    "reopenTask",
    "listNotes",
    "createNote",
    "createDatedNote",
    "createTaskNote",
    "listTaskNotes"
  ].includes(action);
}

function asObject<T>(value: unknown): T {
  return (value && typeof value === "object" ? value : {}) as T;
}

function requiredString(payload: unknown, key: string): string {
  const value = asObject<Record<string, unknown>>(payload)[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required string payload field: ${key}`);
  }
  return value.trim();
}

function optionalString(payload: unknown, key: string): string | undefined {
  const value = asObject<Record<string, unknown>>(payload)[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeAgentBridgeFolder(path: string): string {
  return normalizeVaultPath(path || ".taskhub-agent").replace(/\/$/u, "") || ".taskhub-agent";
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/u, "").replace(/^\.\//u, "");
}

function safeRequestId(requestId: string): string {
  const safe = requestId.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 120);
  return safe || "request";
}
