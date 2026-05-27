import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerGetApiKeyTool } from "../registerGetApiKeyTool";

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

type ToolResult = {
  content: { type: string; text: string }[];
};

/**
 * Creates a mock extra object with optional bearer token in authInfo.
 *
 * @param token - The Bearer token to embed in authInfo, or undefined to simulate no auth.
 */
function createMockExtra(token?: string): ServerRequestHandlerExtra {
  return {
    authInfo: token
      ? {
          token,
          scopes: ["mcp:tools"],
          clientId: "test-account",
          extra: { accountId: "test-account" },
        }
      : undefined,
  } as unknown as ServerRequestHandlerExtra;
}

describe("registerGetApiKeyTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<ToolResult>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((_name, _config, handler) => {
        registeredHandler = handler as typeof registeredHandler;
      }),
    } as unknown as McpServer;

    registerGetApiKeyTool(mockServer);
  });

  it("registers the get_api_key tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "get_api_key",
      expect.objectContaining({
        description: expect.stringContaining("Recoup API key"),
      }),
      expect.any(Function),
    );
  });

  it("returns the bearer token as the api_key when authenticated", async () => {
    const result = await registeredHandler({}, createMockExtra("recoup_sk_test_value"));
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toEqual({ api_key: "recoup_sk_test_value" });
  });

  it("returns an error when authInfo is missing", async () => {
    const result = await registeredHandler({}, createMockExtra(undefined));
    const payload = JSON.parse(result.content[0].text);
    expect(payload.success).toBe(false);
    expect(payload.message).toContain("No authentication credential available");
  });

  it("returns an error when authInfo exists but token is empty", async () => {
    const extra = {
      authInfo: {
        token: "",
        scopes: ["mcp:tools"],
        clientId: "test-account",
        extra: { accountId: "test-account" },
      },
    } as unknown as ServerRequestHandlerExtra;

    const result = await registeredHandler({}, extra);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.success).toBe(false);
  });
});
