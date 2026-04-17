import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistSocials } from "@/lib/artist/getArtistSocials";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

const getArtistSocialsToolSchema = {
  artist_account_id: z
    .string()
    .min(1, "artist_account_id parameter is required")
    .describe("The unique identifier of the artist account"),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Page number for pagination (default: 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Number of socials per page (default: 20, max: 100)"),
};

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
    async args => {
      const result = await getArtistSocials({
        artist_account_id: args.artist_account_id,
        page: args.page ?? 1,
        limit: args.limit ?? 20,
      });
      return getToolResultSuccess(result);
    },
  );
}
