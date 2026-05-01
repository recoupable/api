import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerGetChatsTool } from "../registerGetChatsTool";

const mockSelectRooms = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/supabase/rooms/selectRooms", () => ({
  selectRooms: (...args: unknown[]) => mockSelectRooms(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Creates a mock extra object with optional authInfo.
 *
 * @param authInfo - Optional auth info object containing account ID.
 * @param authInfo.accountId - The account ID for authentication.
 * @returns A mock ServerRequestHandlerExtra object.
 */
function createMockExtra(authInfo?: { accountId?: string }): ServerRequestHandlerExtra {
  return {
    authInfo: authInfo
      ? {
          token: "test-token",
          scopes: ["mcp:tools"],
          clientId: authInfo.accountId,
          extra: {
            accountId: authInfo.accountId,
          },
        }
      : undefined,
  } as unknown as ServerRequestHandlerExtra;
}

describe("registerGetChatsTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerGetChatsTool(mockServer);
  });

  it("registers the get_chats tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "get_chats",
      expect.objectContaining({
        description: "Get chat conversations for accounts.",
      }),
      expect.any(Function),
    );
  });

  it("returns empty chats array when no records exist", async () => {
    mockSelectRooms.mockResolvedValue([]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(mockSelectRooms).toHaveBeenCalledWith({
      account_ids: ["account-123"],
      artist_id: undefined,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"chats":[]'),
        },
      ],
    });
  });

  it("returns chats array with records when they exist", async () => {
    mockSelectRooms.mockResolvedValue([
      {
        id: "chat-456",
        account_id: "account-123",
        artist_id: null,
        topic: "Test Chat",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"chats":['),
        },
      ],
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining('"id":"chat-456"'),
        },
      ],
    });
  });

  it("allows account_id override with access", async () => {
    mockCanAccessAccount.mockResolvedValue(true);
    mockSelectRooms.mockResolvedValue([
      {
        id: "chat-456",
        account_id: "target-account-789",
        artist_id: null,
        topic: "Test Chat",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ]);

    await registeredHandler(
      { account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id" }),
    );

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "target-account-789",
      currentAccountId: "org-account-id",
    });
    expect(mockSelectRooms).toHaveBeenCalledWith({
      account_ids: ["target-account-789"],
      artist_id: undefined,
    });
  });

  it("returns error when auth lacks access to account_id", async () => {
    mockCanAccessAccount.mockResolvedValue(false);

    const result = await registeredHandler(
      { account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Access denied to specified account_id"),
        },
      ],
    });
  });

  it("returns error when neither auth nor account_id is provided", async () => {
    const result = await registeredHandler({}, createMockExtra());

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Authentication required"),
        },
      ],
    });
  });

  it("filters by artist_account_id when provided", async () => {
    const artistChats = [
      { id: "chat-1", account_id: "account-123", artist_id: "artist-456", topic: "Artist Chat" },
    ];
    mockSelectRooms.mockResolvedValue(artistChats);

    await registeredHandler(
      { artist_account_id: "artist-456" },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(mockSelectRooms).toHaveBeenCalledWith({
      account_ids: ["account-123"],
      artist_id: "artist-456",
    });
  });

  it("returns error when selectRooms fails", async () => {
    mockSelectRooms.mockResolvedValue(null);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Failed to retrieve chats"),
        },
      ],
    });
  });

  it("returns error when personal key tries to filter by account_id", async () => {
    mockCanAccessAccount.mockResolvedValue(false);

    const result = await registeredHandler(
      { account_id: "other-account" },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Access denied to specified account_id"),
        },
      ],
    });
  });
});
