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

const artistDeepResearchSchema = z.object({
  artist_account_id: z.string().describe("Artist account ID to research"),
});

type ArtistDeepResearchArgs = z.infer<typeof artistDeepResearchSchema>;

/**
 * Registers the "artist_deep_research" tool on the MCP server.
 * Conducts comprehensive research on an artist across multiple platforms.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerArtistDeepResearchTool(server: McpServer): void {
  server.registerTool(
    "artist_deep_research",
    {
      description:
        "Conducts comprehensive research on an artist across multiple platforms and generates a detailed report. " +
        `Spotify research requirements: ${SPOTIFY_DEEP_RESEARCH_REQUIREMENTS} ` +
        "Other research requirements: " +
        "- Socials: Follower counts, engagement rates, top content, branding, posting consistency " +
        "- Website: Branding, layout, contact info, mailing list " +
        "- YouTube: Consistency, video quality, viewership, contact info " +
        "- Marketing: Campaign ideas, revenue streams, collaboration opportunities, brand partnerships",
      inputSchema: artistDeepResearchSchema,
    },
    async (args: ArtistDeepResearchArgs) => {
      try {
        const { artist_account_id } = args;

        // Fetch all artist socials (high limit to get comprehensive data)
        const artistSocials = await getArtistSocials({
          artist_account_id,
          page: 1,
          limit: 100,
        });

        return getToolResultSuccess({
          artistSocials,
          artist_account_id,
          success: true,
        });
      } catch (error) {
        return getToolResultError(
          error instanceof Error
            ? `Artist deep research failed: ${error.message}`
            : "Artist deep research failed",
        );
      }
    },
  );
}
