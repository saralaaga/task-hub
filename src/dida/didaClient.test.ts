import { DidaClient } from "./didaClient";

describe("DidaClient", () => {
  it("sends authenticated JSON requests for create, update, complete, reopen, and delete", async () => {
    const calls: Array<{ url: string; method: string; body?: string; headers: Record<string, string> }> = [];
    const client = new DidaClient({
      apiBase: "https://api.dida365.com",
      apiToken: "secret-token",
      request: async (request) => {
        calls.push({
          url: request.url,
          method: request.method,
          body: request.body,
          headers: request.headers
        });
        return { status: 200, json: { ok: true } };
      }
    });

    await client.createTask({ title: "A", projectId: "p1" });
    await client.getInboxData();
    await client.updateTask("p1", "t1", { title: "B", projectId: "p2" });
    await client.completeTask("p2", "t1");
    await client.reopenTask("p2", "t1", "B");
    await client.deleteTask("p2", "t1");

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "https://api.dida365.com/open/v1/task"],
      ["GET", "https://api.dida365.com/open/v1/project/inbox/data"],
      ["POST", "https://api.dida365.com/open/v1/task/t1"],
      ["POST", "https://api.dida365.com/open/v1/project/p2/task/t1/complete"],
      ["POST", "https://api.dida365.com/open/v1/task/t1"],
      ["DELETE", "https://api.dida365.com/open/v1/project/p2/task/t1"]
    ]);
    expect(calls.every((call) => call.headers.Authorization === "Bearer secret-token")).toBe(true);
    expect(JSON.parse(calls[0].body ?? "{}")).toEqual({ title: "A", projectId: "p1" });
    expect(JSON.parse(calls[2].body ?? "{}")).toEqual({ title: "B", projectId: "p2" });
    expect(JSON.parse(calls[4].body ?? "{}")).toEqual({ title: "B", projectId: "p2", status: 0 });
  });

  it("does not include the token in thrown HTTP errors", async () => {
    const client = new DidaClient({
      apiBase: "https://api.dida365.com",
      apiToken: "secret-token",
      request: async () => ({ status: 401, text: "secret-token invalid" })
    });

    await expect(client.listProjects()).rejects.toThrow("Dida API request failed with HTTP 401");
    await expect(client.listProjects()).rejects.not.toThrow("secret-token");
  });

  it("falls back to status update when the complete endpoint rejects the project path", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const client = new DidaClient({
      apiBase: "https://api.dida365.com",
      apiToken: "secret-token",
      request: async (request) => {
        calls.push({
          url: request.url,
          method: request.method,
          body: request.body
        });
        if (request.url.endsWith("/complete")) {
          return { status: 404, text: "not found" };
        }
        return { status: 200, json: { ok: true } };
      }
    });

    await client.completeTask("inbox", "t1");

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "https://api.dida365.com/open/v1/project/inbox/task/t1/complete"],
      ["POST", "https://api.dida365.com/open/v1/task/t1"]
    ]);
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({ projectId: "inbox", status: 2 });
  });
});
