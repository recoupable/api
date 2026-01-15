import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mockCreateArtistInDb = vi.fn();
const mockCopyRoom = vi.fn();

vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));

vi.mock("@/lib/rooms/copyRoom", () => ({
  copyRoom: (...args: unknown[]) => mockCopyRoom(...args),
}));

import { registerCreateNewArtistTool } from "../registerCreateNewArtistTool";

describe("registerCreateNewArtistTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown) => Promise<unknown>;

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

  it("creates an artist and returns success", async () => {
    const mockArtist = {
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
      account_info: [{ image: null }],
      account_socials: [],
    };
    mockCreateArtistInDb.mockResolvedValue(mockArtist);

    const result = await registeredHandler({
      name: "Test Artist",
      account_id: "owner-456",
    });

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

    const result = await registeredHandler({
      name: "Test Artist",
      account_id: "owner-456",
      active_conversation_id: "source-room-111",
    });

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

    await registeredHandler({
      name: "Test Artist",
      account_id: "owner-456",
      organization_id: "org-999",
    });

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Test Artist", "owner-456", "org-999");
  });

  it("returns error when artist creation fails", async () => {
    mockCreateArtistInDb.mockResolvedValue(null);

    const result = await registeredHandler({
      name: "Test Artist",
      account_id: "owner-456",
    });

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

    const result = await registeredHandler({
      name: "Test Artist",
      account_id: "owner-456",
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Database connection failed"),
        },
      ],
    });
  });
});
