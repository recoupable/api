import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const artistDeepResearchSchema = z.object({
  artist_account_id: z
    .string()
    .describe("Recoup artist account ID whose saved social profiles to read; not a Spotify ID"),
});

type ArtistDeepResearchArgs = z.infer<typeof artistDeepResearchSchema>;

/**
 * Registers the "artist_deep_research" tool on the MCP server.
 * Reads the first page of saved social profiles under a compatibility tool name.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerArtistDeepResearchTool(server: McpServer): void {
  server.registerTool(
    "artist_deep_research",
    {
      description:
        "Read the artist's currently saved social profiles using a Recoup artist_account_id, not a Spotify ID. Returns page 1, up to 100 profiles, with saved follower counts and updated_at timestamps. This compatibility tool does not refresh metrics or generate a research report. Pagination metadata is nested in artistSocials; this tool has no page input.",
      inputSchema: artistDeepResearchSchema,
    },
    async (args: ArtistDeepResearchArgs) => {
      try {
        const { artist_account_id } = args;

        // Read the first page of saved profiles; no provider refresh or report generation.
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
