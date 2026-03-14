import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerArtistDeepResearchTool } from "../registerArtistDeepResearchTool";

const mockGetArtistSocials = vi.fn();

vi.mock("@/lib/artist/getArtistSocials", () => ({
  getArtistSocials: (...args: unknown[]) => mockGetArtistSocials(...args),
}));

describe("registerArtistDeepResearchTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown) => Promise<unknown>;
  let registeredConfig: { description: string; inputSchema: unknown };

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredConfig = config;
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerArtistDeepResearchTool(mockServer);
  });

  it("registers the artist_deep_research tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "artist_deep_research",
      expect.objectContaining({
        description: expect.stringContaining("comprehensive research"),
      }),
      expect.any(Function),
    );
  });

  it("has correct input schema with artist_account_id", () => {
    expect(registeredConfig.inputSchema).toBeDefined();
  });

  it("returns artist socials data for research", async () => {
    mockGetArtistSocials.mockResolvedValue({
      status: "success",
      socials: [
        {
          id: "social-1",
          social_id: "instagram",
          username: "artist_handle",
          profile_url: "https://instagram.com/artist_handle",
          avatar: "https://example.com/avatar.jpg",
          bio: "Artist bio here",
          follower_count: 10000,
          following_count: 500,
        },
      ],
      pagination: {
        total_count: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      },
    });

    const result = await registeredHandler({
      artist_account_id: "artist-123",
    });

    expect(mockGetArtistSocials).toHaveBeenCalledWith({
      artist_account_id: "artist-123",
      page: 1,
      limit: 100,
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("artist_handle"),
        },
      ],
    });
  });

  it("includes research requirements in description", () => {
    expect(registeredConfig.description).toContain("Spotify");
    expect(registeredConfig.description).toContain("Socials");
  });

  it("returns success flag in response", async () => {
    mockGetArtistSocials.mockResolvedValue({
      status: "success",
      socials: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });

    const result = (await registeredHandler({
      artist_account_id: "artist-123",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.artist_account_id).toBe("artist-123");
  });

  it("handles getArtistSocials errors gracefully", async () => {
    mockGetArtistSocials.mockRejectedValue(new Error("Database connection failed"));

    const result = (await registeredHandler({
      artist_account_id: "artist-123",
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0].text).toContain("Database connection failed");
  });

  it("handles empty socials array", async () => {
    mockGetArtistSocials.mockResolvedValue({
      status: "success",
      socials: [],
      pagination: { total_count: 0, page: 1, limit: 20, total_pages: 0 },
    });

    const result = (await registeredHandler({
      artist_account_id: "artist-123",
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.artistSocials.socials).toEqual([]);
    expect(parsed.success).toBe(true);
  });
});
