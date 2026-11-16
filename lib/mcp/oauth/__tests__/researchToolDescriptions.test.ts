import { beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { registerArtistDeepResearchTool } from "../../tools/registerArtistDeepResearchTool";
import { registerGetSpotifyDeepResearchTool } from "../../tools/spotify/registerGetSpotifyDeepResearchTool";

const mocks = vi.hoisted(() => ({ socials: vi.fn() }));
vi.mock("@/lib/artist/getArtistSocials", () => ({ getArtistSocials: mocks.socials }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("../../tools", async () => {
  const { registerArtistDeepResearchTool } = await import(
    "../../tools/registerArtistDeepResearchTool"
  );
  const { registerGetSpotifyDeepResearchTool } = await import(
    "../../tools/spotify/registerGetSpotifyDeepResearchTool"
  );
  return {
    registerAllTools(server: McpServer) {
      registerArtistDeepResearchTool(server);
      registerGetSpotifyDeepResearchTool(server);
    },
  };
});

const cases = [
  { name: "artist_deep_research", limit: 100, register: registerArtistDeepResearchTool },
  { name: "spotify_deep_research", limit: 20, register: registerGetSpotifyDeepResearchTool },
];
beforeEach(() => vi.clearAllMocks());

it.each(cases)(
  "$name keeps accurate direct descriptions and stays absent from OAuth",
  ({ name, limit, register }) => {
    for (const oauth of [false, true]) {
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;
      if (oauth) {
        registerFullOAuthTools(server, vi.fn(), { prepare: vi.fn(), listArtists: vi.fn() });
      } else {
        register(server);
      }
      const registration = registerTool.mock.calls.find(([tool]) => tool === name);
      if (oauth) {
        expect(registration).toBeUndefined();
        continue;
      }
      const config = registration![1];
      expect(config.description).toContain("saved social profiles");
      expect(config.description).toContain(`page 1, up to ${limit}`);
      expect(config.description).toContain("this tool has no page input");
      expect(config.description).toContain(
        name === "artist_deep_research"
          ? "Pagination metadata is nested in artistSocials"
          : "Pagination metadata is returned alongside artistSocials",
      );
      if (name === "spotify_deep_research")
        expect(config.description).toContain("across saved platforms, not just Spotify");
      expect(config.description).toContain(
        "does not refresh metrics or generate a research report",
      );
      expect(config.description).not.toMatch(/MANDATORY|comprehensive research|using a Spotify ID/);
      expect(Object.keys(config.inputSchema.shape)).toEqual(["artist_account_id"]);
      expect(config.inputSchema.shape.artist_account_id.description).toContain(
        "Recoup artist account ID",
      );
      expect(config.inputSchema.shape.artist_account_id.description).toContain("not a Spotify ID");
      expect(config.inputSchema.safeParse({ artist_account_id: "artist-123" }).success).toBe(true);
      // Preserve the existing difference in empty-string validation.
      expect(config.inputSchema.safeParse({ artist_account_id: "" }).success).toBe(
        name === "artist_deep_research",
      );
    }
    expect(mocks.socials).not.toHaveBeenCalled();
  },
);

it.each(cases)(
  "$name retains its callback pagination and response envelope",
  async ({ name, limit, register }) => {
    const saved = {
      status: "success",
      socials: [
        { social_id: "saved-profile", follower_count: 42, updated_at: "2026-01-01T00:00:00Z" },
      ],
      pagination: { page: 1, limit, total_count: 125, total_pages: Math.ceil(125 / limit) },
    };
    mocks.socials.mockResolvedValue(saved);
    const registerTool = vi.fn();
    register({ registerTool } as unknown as McpServer);
    const handler = registerTool.mock.calls[0][2];
    const result = await handler({ artist_account_id: "artist-123" });
    expect(mocks.socials).toHaveBeenCalledExactlyOnceWith({
      artist_account_id: "artist-123",
      page: 1,
      limit,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(
      name === "artist_deep_research"
        ? { artistSocials: saved, artist_account_id: "artist-123", success: true }
        : {
            success: true,
            artistSocials: { socials: saved.socials },
            artist_account_id: "artist-123",
            pagination: saved.pagination,
          },
    );
  },
);
