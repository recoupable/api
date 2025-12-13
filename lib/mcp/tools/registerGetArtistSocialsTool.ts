import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import {
  ArtistSocialsQuery,
  artistSocialsQuerySchema,
} from "@/lib/artist/validateArtistSocialsQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "get_artist_socials" tool on the MCP server.
 * Retrieves all social profiles associated with an artist account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetArtistSocialsTool(server: McpServer): void {
  server.registerTool(
    "get_artist_socials",
    {
      description:
        "Retrieve all socials (handle, avatar, profile url, bio, follower count, following count) associated with an artist.",
      inputSchema: artistSocialsQuerySchema,
    },
    async (args: ArtistSocialsQuery) => {
      const result = await getArtistSocials(args);
      return getToolResultSuccess(result);
    },
  );
}
