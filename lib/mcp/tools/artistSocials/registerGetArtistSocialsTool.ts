import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import {
  GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS,
  getArtistSocialsToolSchema,
  type ArtistSocialsToolInput,
} from "@/lib/artist/validateGetArtistSocialsRequest";
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
      inputSchema: getArtistSocialsToolSchema,
    },
    async (args: ArtistSocialsToolInput) => {
      const result = await getArtistSocials({
        artist_account_id: args.artist_account_id,
        page: args.page ?? GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.page,
        limit: args.limit ?? GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.limit,
      });
      return getToolResultSuccess(result);
    },
  );
}
