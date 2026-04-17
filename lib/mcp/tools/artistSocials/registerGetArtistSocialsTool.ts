import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { getArtistSocialsToolSchema } from "@/lib/artist/validateGetArtistSocialsRequest";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

export function registerGetArtistSocialsTool(server: McpServer): void {
  server.registerTool(
    "get_artist_socials",
    {
      description:
        "Retrieve all socials (handle, avatar, profile url, bio, follower count, following count) associated with an artist.",
      inputSchema: getArtistSocialsToolSchema,
    },
    async args => getToolResultSuccess(await getArtistSocials(args)),
  );
}
