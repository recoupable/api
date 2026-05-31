import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerGetChatsTool } from "../registerGetChatsTool";

const mockSelectChatsWithSessions = vi.fn();
const mockCanAccessAccount = vi.fn();
const mockGetAccountOrganizations = vi.fn();

vi.mock("@/lib/supabase/chats/selectChatsWithSessions", () => ({
  selectChatsWithSessions: (...args: unknown[]) => mockSelectChatsWithSessions(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: (...args: unknown[]) => mockGetAccountOrganizations(...args),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

type ServerRequestHandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Creates a mock extra object with optional authInfo.
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

describe("registerGetChatsTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: caller is NOT in Recoup org. Admin tests override.
    mockGetAccountOrganizations.mockResolvedValue([]);

    mockServer = {
      registerTool: vi.fn((_name, _config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerGetChatsTool(mockServer);
  });

  it("registers the get_chats tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "get_chats",
      expect.objectContaining({
        description: expect.stringContaining("chat"),
      }),
      expect.any(Function),
    );
  });

  it("returns empty chats array when no records exist", async () => {
    mockSelectChatsWithSessions.mockResolvedValue([]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    expect(mockSelectChatsWithSessions).toHaveBeenCalledWith({
      accountIds: ["account-123"],
      artistAccountId: undefined,
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

  it("returns chats projected to the new wire shape including artistId", async () => {
    mockSelectChatsWithSessions.mockResolvedValue([
      {
        id: "chat-456",
        title: "Test Chat",
        session_id: "sess-1",
        updated_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        active_stream_id: null,
        last_assistant_message_at: null,
        model_id: null,
        session: { id: "sess-1", account_id: "account-123", artist_id: "artist-789" },
      },
    ]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));

    const textNode = (result as { content: { type: string; text: string }[] }).content[0];
    expect(textNode.text).toContain('"sessionId":"sess-1"');
    expect(textNode.text).toContain('"accountId":"account-123"');
    expect(textNode.text).toContain('"artistId":"artist-789"');
  });

  it("surfaces artistId as null when session has no artist", async () => {
    mockSelectChatsWithSessions.mockResolvedValue([
      {
        id: "chat-456",
        title: "Test Chat",
        session_id: "sess-1",
        updated_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        active_stream_id: null,
        last_assistant_message_at: null,
        model_id: null,
        session: { id: "sess-1", account_id: "account-123", artist_id: null },
      },
    ]);

    const result = await registeredHandler({}, createMockExtra({ accountId: "account-123" }));
    const textNode = (result as { content: { type: string; text: string }[] }).content[0];
    expect(textNode.text).toContain('"artistId":null');
  });

  it("allows account_id override with access", async () => {
    mockCanAccessAccount.mockResolvedValue(true);
    mockSelectChatsWithSessions.mockResolvedValue([]);

    await registeredHandler(
      { account_id: "target-account-789" },
      createMockExtra({ accountId: "org-account-id" }),
    );

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "target-account-789",
      currentAccountId: "org-account-id",
    });
    expect(mockSelectChatsWithSessions).toHaveBeenCalledWith({
      accountIds: ["target-account-789"],
      artistAccountId: undefined,
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

  it("passes artist_account_id through to the select", async () => {
    mockSelectChatsWithSessions.mockResolvedValue([]);

    await registeredHandler(
      { artist_account_id: "artist-456" },
      createMockExtra({ accountId: "account-123" }),
    );

    expect(mockSelectChatsWithSessions).toHaveBeenCalledWith({
      accountIds: ["account-123"],
      artistAccountId: "artist-456",
    });
  });

  it("passes undefined accountIds for Recoup admin (membership-based)", async () => {
    mockGetAccountOrganizations.mockResolvedValue([{ organization_id: "recoup-org-id" }]);
    mockSelectChatsWithSessions.mockResolvedValue([]);

    await registeredHandler({}, createMockExtra({ accountId: "admin-account-123" }));

    expect(mockGetAccountOrganizations).toHaveBeenCalledWith({ accountId: "admin-account-123" });
    expect(mockSelectChatsWithSessions).toHaveBeenCalledWith({
      accountIds: undefined,
      artistAccountId: undefined,
    });
  });

  it("returns error when selectChatsWithSessions fails", async () => {
    mockSelectChatsWithSessions.mockResolvedValue(null);

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
