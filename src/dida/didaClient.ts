export type DidaRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type DidaResponse = {
  status: number;
  json?: unknown;
  text?: string;
};

export type DidaRequester = (request: DidaRequest) => Promise<DidaResponse>;

export type DidaProjectRecord = {
  id: string;
  name: string;
};

export type DidaTaskRecord = {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status?: number;
  completedTime?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  tags?: string[];
  items?: Array<{ title?: string; status?: number }>;
};

export type DidaProjectData = {
  project?: DidaProjectRecord;
  tasks: DidaTaskRecord[];
};

export type DidaTaskPayload = {
  title?: string;
  projectId?: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  status?: number;
  tags?: string[];
};

export class DidaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "DidaApiError";
  }
}

export class DidaClient {
  private readonly apiBase: string;
  private readonly apiToken: string;
  private readonly request: DidaRequester;

  constructor(input: { apiBase: string; apiToken: string; request: DidaRequester }) {
    this.apiBase = input.apiBase.replace(/\/+$/u, "");
    this.apiToken = input.apiToken;
    this.request = input.request;
  }

  async listProjects(): Promise<DidaProjectRecord[]> {
    const result = await this.call("GET", "/open/v1/project");
    return Array.isArray(result) ? result as DidaProjectRecord[] : [];
  }

  async getProjectData(projectId: string): Promise<DidaProjectData> {
    return await this.call("GET", `/open/v1/project/${encodeURIComponent(projectId)}/data`) as DidaProjectData;
  }

  async getInboxData(): Promise<DidaProjectData> {
    return await this.call("GET", "/open/v1/project/inbox/data") as DidaProjectData;
  }

  async createTask(payload: DidaTaskPayload): Promise<DidaTaskRecord> {
    return await this.call("POST", "/open/v1/task", payload) as DidaTaskRecord;
  }

  async updateTask(projectId: string, taskId: string, payload: DidaTaskPayload): Promise<DidaTaskRecord> {
    const body = { ...payload, projectId: payload.projectId ?? projectId };
    return await this.call("POST", `/open/v1/task/${encodeURIComponent(taskId)}`, body) as DidaTaskRecord;
  }

  async completeTask(projectId: string, taskId: string): Promise<void> {
    try {
      await this.call("POST", `/open/v1/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`);
    } catch (error) {
      if (!isProjectScopedTaskPathError(error)) throw error;
      await this.updateTask(projectId, taskId, { projectId, status: 2 });
    }
  }

  async reopenTask(projectId: string, taskId: string, title: string): Promise<void> {
    await this.updateTask(projectId, taskId, { title, projectId, status: 0 });
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await this.call("DELETE", `/open/v1/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`);
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.request({
      url: `${this.apiBase}${path}`,
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json"
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

    if (response.status < 200 || response.status >= 300) {
      throw new DidaApiError(`Dida API request failed with HTTP ${response.status}`, response.status);
    }
    return response.json ?? parseJsonText(response.text);
  }
}

function isProjectScopedTaskPathError(error: unknown): boolean {
  return error instanceof DidaApiError && (error.status === 400 || error.status === 404);
}

function parseJsonText(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
