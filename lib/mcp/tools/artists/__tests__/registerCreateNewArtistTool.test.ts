import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

import { registerCreateNewArtistTool } from "../registerCreateNewArtistTool";

const mockCreateArtistInDb = vi.fn();
const mockCopyRoom = vi.fn();
const mockCanAccessAccount = vi.fn();

vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));

vi.mock("@/lib/rooms/copyRoom", () => ({
  copyRoom: (...args: unknown[]) => mockCopyRoom(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
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

describe("registerCreateNewArtistTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown, extra: ServerRequestHandlerExtra) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerCreateNewArtistTool(mockServer);
  });

  it("registers the create_new_artist tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "create_new_artist",
      expect.objectContaining({
        description: expect.stringContaining("Create a new artist account"),
      }),
      expect.any(Function),
    );
  });

  it("creates an artist and returns success with account_id", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const result = await registeredHandler(
      {
        name: "Test Artist",
        account_id: "owner-456",
      },
      createMockExtra(),
    );

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Test Artist", "owner-456", undefined);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Successfully created artist"),
        },
      ],
    });
  });

  it("creates an artist using auth info accountId", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const result = await registeredHandler(
      {
        name: "Test Artist",
      },
      createMockExtra({ accountId: "auth-account-123" }),
    );

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Test Artist", "auth-account-123", undefined);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Successfully created artist"),
        },
      ],
    });
  });

  it("copies room when active_conversation_id is provided", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);
    mockCopyRoom.mockResolvedValue("new-room-789");

    const result = await registeredHandler(
      {
        name: "Test Artist",
        account_id: "owner-456",
        active_conversation_id: "source-room-111",
      },
      createMockExtra(),
    );

    expect(mockCopyRoom).toHaveBeenCalledWith("source-room-111", "artist-123");
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("new-room-789"),
        },
      ],
    });
  });

  it("passes organization_id to createArtistInDb", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    await registeredHandler(
      {
        name: "Test Artist",
        account_id: "owner-456",
        organization_id: "org-999",
      },
      createMockExtra(),
    );

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Test Artist", "owner-456", "org-999");
  });

  it("returns error when artist creation fails", async () => {
    mockCreateArtistInDb.mockResolvedValue(null);

    const result = await registeredHandler(
      {
        name: "Test Artist",
        account_id: "owner-456",
      },
      createMockExtra(),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Failed to create artist"),
        },
      ],
    });
  });

  it("returns error with message when exception is thrown", async () => {
    mockCreateArtistInDb.mockRejectedValue(new Error("Database connection failed"));

    const result = await registeredHandler(
      {
        name: "Test Artist",
        account_id: "owner-456",
      },
      createMockExtra(),
    );

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Database connection failed"),
        },
      ],
    });
  });

  it("allows account_id override for org auth with access", async () => {
    mockCanAccessAccount.mockResolvedValue(true);
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    await registeredHandler(
      {
        name: "Test Artist",
        account_id: "target-account-456",
      },
      createMockExtra({ accountId: "org-account-id", orgId: "org-account-id" }),
    );

    expect(mockCanAccessAccount).toHaveBeenCalledWith({
      orgId: "org-account-id",
      targetAccountId: "target-account-456",
    });
    expect(mockCreateArtistInDb).toHaveBeenCalledWith(
      "Test Artist",
      "target-account-456",
      undefined,
    );
  });

  it("returns error when org auth lacks access to account_id", async () => {
    mockCanAccessAccount.mockResolvedValue(false);

    const result = await registeredHandler(
      {
        name: "Test Artist",
        account_id: "target-account-456",
      },
      createMockExtra({ accountId: "org-account-id", orgId: "org-account-id" }),
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
    const result = await registeredHandler(
      {
        name: "Test Artist",
      },
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
});
