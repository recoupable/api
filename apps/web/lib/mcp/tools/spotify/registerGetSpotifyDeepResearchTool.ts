import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const SPOTIFY_DEEP_RESEARCH_REQUIREMENTS = `
  - popularity info (MANDATORY):
    * Track popularity scores (0-100) for all tracks
    * Average popularity across all tracks
    * Most popular tracks ranked by popularity
    * Popularity trends over time (if available)
  - Spotify follower metrics (MANDATORY):
    * Current total follower count for the artist on Spotify
  - engagement info
  - tracklist
  - collaborators
  - album art
  - album name
`;

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifyDeepResearchSchema = z.object({
  artist_account_id: z.string().min(1, "Artist account ID is required"),
});

type GetSpotifyDeepResearchArgs = z.infer<typeof getSpotifyDeepResearchSchema>;

/**
 * Registers the "spotify_deep_research" tool on the MCP server.
 * Performs deep research on an artist using a Spotify ID.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifyDeepResearchTool(server: McpServer): void {
  server.registerTool(
    "spotify_deep_research",
    {
      description: `Performs deep research on an artist using a Spotify ID.

  Required items in deep research document:
  ${SPOTIFY_DEEP_RESEARCH_REQUIREMENTS}`,
      inputSchema: getSpotifyDeepResearchSchema,
    },
    async (args: GetSpotifyDeepResearchArgs) => {
      try {
        // Call getArtistSocials with default pagination (page 1, limit 20)
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
