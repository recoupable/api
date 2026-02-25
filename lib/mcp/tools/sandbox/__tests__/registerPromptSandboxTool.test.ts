import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerPromptSandboxTool } from "../registerPromptSandboxTool";

const mockPromptSandbox = vi.fn();
const mockResolveAccountId = vi.fn();

vi.mock("@/lib/sandbox/promptSandbox", () => ({
  promptSandbox: (...args: unknown[]) => mockPromptSandbox(...args),
}));

vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: (...args: unknown[]) => mockResolveAccountId(...args),
}));

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

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

describe("registerPromptSandboxTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerPromptSandboxTool(mockServer);
  });

  it("registers the prompt_sandbox tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "prompt_sandbox",
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
      { prompt: "hello" },
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
      { prompt: "hello" },
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

  it("calls promptSandbox and returns success", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockPromptSandbox.mockResolvedValue({
      sandboxId: "sbx_123",
      stdout: "Hello world",
      stderr: "",
      exitCode: 0,
      created: false,
    });

    const result = await registeredHandler(
      { prompt: "say hello" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(mockPromptSandbox).toHaveBeenCalledWith({
      accountId: "acc_123",
      apiKey: "test-token",
      prompt: "say hello",
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
          text: expect.stringContaining('"stdout":"Hello world"'),
        },
      ],
    });
  });

  it("resolves accountId from auth only without override", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockPromptSandbox.mockResolvedValue({
      sandboxId: "sbx_123",
      stdout: "",
      stderr: "",
      exitCode: 0,
      created: false,
    });

    const extra = createMockExtra({ accountId: "acc_123" });
    await registeredHandler({ prompt: "test" }, extra);

    expect(mockResolveAccountId).toHaveBeenCalledWith({
      authInfo: extra.authInfo,
    });
  });

  it("returns error when promptSandbox throws", async () => {
    mockResolveAccountId.mockResolvedValue({
      accountId: "acc_123",
      error: null,
    });
    mockPromptSandbox.mockRejectedValue(new Error("Sandbox timed out"));

    const result = await registeredHandler(
      { prompt: "hello" },
      createMockExtra({ accountId: "acc_123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Sandbox timed out"),
        },
      ],
    });
  });
});
