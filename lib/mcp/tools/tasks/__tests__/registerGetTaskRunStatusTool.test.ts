import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerGetTaskRunStatusTool } from "../registerGetTaskRunStatusTool";

const mockRetrieveTaskRun = vi.fn();
const mockResolveAccountId = vi.fn();

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: (...args: unknown[]) => mockRetrieveTaskRun(...args),
}));

vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: (...args: unknown[]) => mockResolveAccountId(...args),
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

describe("registerGetTaskRunStatusTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerGetTaskRunStatusTool(mockServer);
  });

  it("registers the get_task_run_status tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "get_task_run_status",
      expect.objectContaining({
        description: expect.any(String),
      }),
      expect.any(Function),
    );
  });

  it("returns error when resolveAccountId returns an error", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: null,
      error: "Authentication required. Provide an API key via Authorization: Bearer header, or provide account_id from the system prompt context.",
    });

    const result = await registeredHandler(
      { runId: "run_123" },
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

  it("returns error when resolveAccountId returns null accountId without error", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: null,
      error: null,
    });

    const result = await registeredHandler(
      { runId: "run_123" },
      createMockExtra(),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Failed to resolve account ID"),
        },
      ],
    });
  });

  it("passes authInfo to resolveAccountId", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockRetrieveTaskRun.mockResolvedValue({
      status: "complete",
      data: null,
      metadata: null,
      taskIdentifier: "test-task",
      createdAt: "2024-01-01T00:00:00.000Z",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    });

    const extra = createMockExtra({ accountId: "acc_123" });
    await registeredHandler({ runId: "run_123" }, extra);

    expect(mockResolveAccountId).toHaveBeenCalledWith({
      authInfo: extra.authInfo,
      accountIdOverride: undefined,
    });
  });

  it("returns task run status on success", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockRetrieveTaskRun.mockResolvedValue({
      status: "complete",
      data: { output: "done" },
      metadata: { logs: ["step 1", "step 2"] },
      taskIdentifier: "run-sandbox-command",
      createdAt: "2024-01-01T00:00:00.000Z",
      startedAt: "2024-01-01T00:00:01.000Z",
      finishedAt: "2024-01-01T00:00:05.000Z",
      durationMs: 4000,
    });

    const result = await registeredHandler(
      { runId: "run_123" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(mockRetrieveTaskRun).toHaveBeenCalledWith("run_123");
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"status":"complete"'),
        },
      ],
    });
  });

  it("returns error when task run is not found", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockRetrieveTaskRun.mockResolvedValue(null);

    const result = await registeredHandler(
      { runId: "run_nonexistent" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("not found"),
        },
      ],
    });
  });

  it("returns error when retrieveTaskRun throws", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockRetrieveTaskRun.mockRejectedValue(new Error("Trigger API error"));

    const result = await registeredHandler(
      { runId: "run_123" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Trigger API error"),
        },
      ],
    });
  });
});
