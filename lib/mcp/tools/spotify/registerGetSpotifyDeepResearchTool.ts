import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifyDeepResearchSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Recoup artist account ID whose saved social profiles to read; not a Spotify ID"),
});

type GetSpotifyDeepResearchArgs = z.infer<typeof getSpotifyDeepResearchSchema>;

/**
 * Registers the "spotify_deep_research" tool on the MCP server.
 * Reads the first page of saved social profiles under a compatibility tool name.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifyDeepResearchTool(server: McpServer): void {
  server.registerTool(
    "spotify_deep_research",
    {
      description:
        "Read the artist's currently saved social profiles using a Recoup artist_account_id, not a Spotify ID. Returns page 1, up to 20 profiles across saved platforms, not just Spotify, with saved follower counts and updated_at timestamps. This compatibility tool does not refresh metrics or generate a research report. Pagination metadata is returned alongside artistSocials; this tool has no page input.",
      inputSchema: getSpotifyDeepResearchSchema,
    },
    async (args: GetSpotifyDeepResearchArgs) => {
      try {
        // Read the first page of saved profiles; no Spotify filter or provider refresh.
        const result = await getArtistSocials({
          artist_account_id: args.artist_account_id,
          page: 1,
          limit: 20,
        });

        if (result.status === "error") {
          return getToolResultError(result.message || "Failed to fetch artist socials");
        }

        // Format response to match the original tool's expected structure
        const response = {
          success: true,
          artistSocials: {
            socials: result.socials,
          },
          artist_account_id: args.artist_account_id,
          pagination: result.pagination,
        };

        return getToolResultSuccess(response);
      } catch (error) {
        console.error("Error performing Spotify deep research:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to perform Spotify deep research",
        );
      }
    },
  );
}
