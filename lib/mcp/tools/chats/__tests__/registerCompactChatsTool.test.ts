import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCompactChatsTool } from "../registerCompactChatsTool";

const mockProcessCompactChatRequest = vi.fn();

vi.mock("@/lib/chats/processCompactChatRequest", () => ({
  processCompactChatRequest: (...args: unknown[]) => mockProcessCompactChatRequest(...args),
}));

vi.mock("@/lib/mcp/getToolResultSuccess", () => ({
  getToolResultSuccess: vi.fn((data: unknown) => ({
    content: [{ type: "text", text: JSON.stringify(data) }],
  })),
}));

vi.mock("@/lib/mcp/getToolResultError", () => ({
  getToolResultError: vi.fn((message: string) => ({
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  })),
}));

describe("registerCompactChatsTool", () => {
  let server: McpServer;
  let registeredHandler: (args: unknown, extra: unknown) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    server = {
      registerTool: vi.fn((name, schema, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerCompactChatsTool(server);
  });

  it("registers the tool with correct name and schema", () => {
    expect(server.registerTool).toHaveBeenCalledWith(
      "compact_chats",
      expect.objectContaining({
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    );
  });

  it("returns error when authentication is missing", async () => {
    const result = await registeredHandler({ chat_id: ["chat-123"] }, { authInfo: undefined });

    expect(result).toHaveProperty("isError", true);
  });

  it("returns error when chat_id is empty", async () => {
    const result = await registeredHandler(
      { chat_id: [] },
      { authInfo: { extra: { accountId: "account-123", orgId: null } } },
    );

    expect(result).toHaveProperty("isError", true);
  });

  it("calls processCompactChatRequest for each chat", async () => {
    mockProcessCompactChatRequest.mockResolvedValue({
      type: "success",
      result: { chatId: "chat-123", compacted: "Summary" },
    });

    await registeredHandler(
      { chat_id: ["chat-123", "chat-456"] },
      { authInfo: { extra: { accountId: "account-123", orgId: "org-456" } } },
    );

    expect(mockProcessCompactChatRequest).toHaveBeenCalledTimes(2);
    expect(mockProcessCompactChatRequest).toHaveBeenCalledWith({
      chatId: "chat-123",
      prompt: undefined,
      accountId: "account-123",
      orgId: "org-456",
    });
    expect(mockProcessCompactChatRequest).toHaveBeenCalledWith({
      chatId: "chat-456",
      prompt: undefined,
      accountId: "account-123",
      orgId: "org-456",
    });
  });

  it("passes custom prompt to processCompactChatRequest", async () => {
    mockProcessCompactChatRequest.mockResolvedValue({
      type: "success",
      result: { chatId: "chat-123", compacted: "Summary" },
    });

    await registeredHandler(
      { chat_id: ["chat-123"], prompt: "Focus on action items" },
      { authInfo: { extra: { accountId: "account-123", orgId: null } } },
    );

    expect(mockProcessCompactChatRequest).toHaveBeenCalledWith({
      chatId: "chat-123",
      prompt: "Focus on action items",
      accountId: "account-123",
      orgId: undefined,
    });
  });

  it("returns error when any chat is not found", async () => {
    mockProcessCompactChatRequest
      .mockResolvedValueOnce({
        type: "success",
        result: { chatId: "chat-123", compacted: "Summary" },
      })
      .mockResolvedValueOnce({ type: "notFound", chatId: "chat-456" });

    const result = await registeredHandler(
      { chat_id: ["chat-123", "chat-456"] },
      { authInfo: { extra: { accountId: "account-123", orgId: null } } },
    );

    expect(result).toHaveProperty("isError", true);
  });

  it("returns success with compacted chats", async () => {
    mockProcessCompactChatRequest
      .mockResolvedValueOnce({
        type: "success",
        result: { chatId: "chat-123", compacted: "Summary 1" },
      })
      .mockResolvedValueOnce({
        type: "success",
        result: { chatId: "chat-456", compacted: "Summary 2" },
      });

    const result = await registeredHandler(
      { chat_id: ["chat-123", "chat-456"] },
      { authInfo: { extra: { accountId: "account-123", orgId: null } } },
    );

    expect(result).not.toHaveProperty("isError");
    const content = (result as { content: { text: string }[] }).content[0].text;
    const parsed = JSON.parse(content);
    expect(parsed.chats).toHaveLength(2);
  });
});
