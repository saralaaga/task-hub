import {
  agentBridgeResponsePath,
  agentBridgeRequestPathsFromListing,
  executeAgentBridgeRequest,
  isAgentBridgeRequestPath,
  parseAgentBridgeRequest
} from "./agentBridge";

describe("agent bridge helpers", () => {
  it("detects request paths only when enabled", () => {
    expect(isAgentBridgeRequestPath({ enabled: false, folder: ".taskhub-agent" }, ".taskhub-agent/requests/a.json")).toBe(false);
    expect(isAgentBridgeRequestPath({ enabled: true, folder: ".taskhub-agent" }, ".taskhub-agent/requests/a.json")).toBe(true);
    expect(isAgentBridgeRequestPath({ enabled: true, folder: ".taskhub-agent" }, ".taskhub-agent/responses/a.json")).toBe(false);
    expect(isAgentBridgeRequestPath({ enabled: true, folder: ".taskhub-agent" }, ".taskhub-agent/requests/a.md")).toBe(false);
  });

  it("builds safe response paths", () => {
    expect(agentBridgeResponsePath({ folder: ".taskhub-agent" }, "../bad/id")).toBe(".taskhub-agent/responses/.._bad_id.json");
  });

  it("collects pending request paths from adapter listings", () => {
    expect(agentBridgeRequestPathsFromListing(
      { enabled: true, folder: ".taskhub-agent" },
      [
        ".taskhub-agent/requests/a.json",
        ".taskhub-agent/requests/nested/b.json",
        ".taskhub-agent/responses/a.json",
        "Task Hub.md"
      ]
    )).toEqual([
      ".taskhub-agent/requests/a.json",
      ".taskhub-agent/requests/nested/b.json"
    ]);
  });

  it("parses valid requests and converts invalid JSON to response errors", () => {
    expect(parseAgentBridgeRequest(
      JSON.stringify({ version: 1, requestId: "req-1", action: "listTasks", payload: { status: "open" } }),
      "fallback"
    )).toEqual({
      version: 1,
      requestId: "req-1",
      action: "listTasks",
      payload: { status: "open" }
    });

    expect(parseAgentBridgeRequest("{", "fallback")).toEqual({
      version: 1,
      requestId: "fallback",
      ok: false,
      error: expect.objectContaining({ code: "validation_error" })
    });
  });

  it("executes API actions and returns bridge responses", async () => {
    const api = {
      listTasks: jest.fn(() => ({ ok: true, data: { tasks: [] } }))
    };

    const response = await executeAgentBridgeRequest(api as never, {
      version: 1,
      requestId: "req-1",
      action: "listTasks",
      payload: { status: "open" }
    });

    expect(api.listTasks).toHaveBeenCalledWith({ status: "open" });
    expect(response).toEqual({
      version: 1,
      requestId: "req-1",
      ok: true,
      data: { tasks: [] }
    });
  });

  it("returns validation errors for missing required payload fields", async () => {
    const response = await executeAgentBridgeRequest({} as never, {
      version: 1,
      requestId: "req-1",
      action: "getTask",
      payload: {}
    });

    expect(response).toEqual({
      version: 1,
      requestId: "req-1",
      ok: false,
      error: {
        code: "validation_error",
        message: "Missing required string payload field: stableId"
      }
    });
  });
});
