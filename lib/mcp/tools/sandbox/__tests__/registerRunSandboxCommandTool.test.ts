import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerRunSandboxCommandTool } from "../registerRunSandboxCommandTool";

const mockProcessCreateSandbox = vi.fn();

vi.mock("@/lib/sandbox/processCreateSandbox", () => ({
  processCreateSandbox: (...args: unknown[]) => mockProcessCreateSandbox(...args),
}));

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Creates a mock extra object with optional authInfo.
 *
 * @param authInfo
 * @param authInfo.accountId
 * @param authInfo.orgId
 */
function createMockExtra(authInfo?: {
  accountId?: string;
  orgId?: string | null;
}): ServerRequestHandlerExtra {
  return {
    authInfo: authInfo
      ? {
          token: "test-token",
          scopes: ["mcp:tools"],
          clientId: authInfo.accountId,
          extra: {
            accountId: authInfo.accountId,
            orgId: authInfo.orgId ?? null,
          },
        }
      : undefined,
  } as unknown as ServerRequestHandlerExtra;
}

describe("registerRunSandboxCommandTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerRunSandboxCommandTool(mockServer);
  });

  it("registers the run_sandbox_command tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "run_sandbox_command",
      expect.objectContaining({
        description: expect.any(String),
      }),
      expect.any(Function),
    );
  });

  it("returns error when no auth is provided", async () => {
    const result = await registeredHandler(
      { command: "ls" },
      createMockExtra(),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Authentication required"),
        },
      ],
    });
  });

  it("calls processCreateSandbox with command and returns success", async () => {
    mockProcessCreateSandbox.mockResolvedValue({
      sandboxId: "sbx_123",
      sandboxStatus: "running",
      timeout: 600000,
      createdAt: "2024-01-01T00:00:00.000Z",
      runId: "run_abc123",
    });

    const result = await registeredHandler(
      { command: "npm install", args: ["express"], cwd: "/app" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(mockProcessCreateSandbox).toHaveBeenCalledWith({
      accountId: "acc_123",
      command: "npm install",
      args: ["express"],
      cwd: "/app",
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"sandboxId":"sbx_123"'),
        },
      ],
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"runId":"run_abc123"'),
        },
      ],
    });
  });

  it("returns error when processCreateSandbox throws", async () => {
    mockProcessCreateSandbox.mockRejectedValue(new Error("Sandbox creation failed"));

    const result = await registeredHandler(
      { command: "ls" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Sandbox creation failed"),
        },
      ],
    });
  });
});
