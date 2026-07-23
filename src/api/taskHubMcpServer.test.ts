import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const server = require("../../mcp/taskhub-mcp-server.cjs") as {
  TOOL_DEFINITIONS: Array<{ name: string }>;
  bridgePaths(options: { vaultPath: string; bridgeFolder?: string }): { requests: string; responses: string };
  callBridgeAction(action: string, payload: unknown, options: { vaultPath: string; requestId: string; timeoutMs: number }): Promise<unknown>;
  handleJsonRpc(message: { method: string; params?: unknown }): Promise<unknown>;
  safeFileName(value: string): string;
};

describe("taskhub MCP server", () => {
  it("lists Task Hub bridge tools", async () => {
    const result = await server.handleJsonRpc({ method: "tools/list" }) as { tools: Array<{ name: string }> };

    expect(result.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "taskhub_capabilities",
      "taskhub_list_tasks",
      "taskhub_create_task",
      "taskhub_complete_task",
      "taskhub_create_note",
      "taskhub_create_task_note"
    ]));
  });

  it("writes bridge requests and reads matching responses", async () => {
    const vaultPath = mkdtempSync(join(tmpdir(), "taskhub-mcp-test-"));
    const requestId = "req-test-1";
    const paths = server.bridgePaths({ vaultPath });

    const pending = server.callBridgeAction("capabilities", {}, { vaultPath, requestId, timeoutMs: 1000 });
    setTimeout(() => {
      writeFileSync(
        join(paths.responses, `${requestId}.json`),
        `${JSON.stringify({ version: 1, requestId, ok: true, data: { version: 1 } })}\n`,
        "utf8"
      );
    }, 20);

    await expect(pending).resolves.toEqual({
      version: 1,
      requestId,
      ok: true,
      data: { version: 1 }
    });
  });

  it("sanitizes response filenames", () => {
    expect(server.safeFileName("../bad/id")).toBe(".._bad_id");
  });
});
