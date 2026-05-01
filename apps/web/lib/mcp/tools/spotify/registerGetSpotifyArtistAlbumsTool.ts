import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtistAlbums from "@/lib/spotify/getArtistAlbums";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifyArtistAlbumsSchema = z.object({
  id: z.string().min(1, "Artist ID is required"),
  include_groups: z
    .string()
    .optional()
    .describe("Comma separated values of album types: album, single, appears_on, compilation"),
  market: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code"),
  limit: z.number().min(1).max(50).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

type GetSpotifyArtistAlbumsArgs = z.infer<typeof getSpotifyArtistAlbumsSchema>;

/**
 * Registers the "get_spotify_artist_albums" tool on the MCP server.
 * Retrieve Spotify catalog information about an artist's albums.
 * You should call get_artist_socials or get_spotify_search first to obtain the artist ID before using this tool.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifyArtistAlbumsTool(server: McpServer): void {
  server.registerTool(
    "get_spotify_artist_albums",
    {
      description:
        "Retrieve Spotify catalog information about an artist's albums. You should call get_artist_socials or get_spotify_search first to obtain the artist ID before using this tool.",
      inputSchema: getSpotifyArtistAlbumsSchema,
    },
    async (args: GetSpotifyArtistAlbumsArgs) => {
      try {
        // Generate Spotify access token
        const tokenResult = await generateAccessToken();

        if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
          return getToolResultError("Failed to generate Spotify access token");
        }

        // Call Spotify API to get artist albums
        const { data, error } = await getArtistAlbums({
          id: args.id,
          include_groups: args.include_groups,
          market: args.market,
          limit: args.limit,
          offset: args.offset,
          accessToken: tokenResult.access_token,
        });

        if (error || !data) {
          return getToolResultError(error?.message || "Failed to fetch Spotify artist albums");
        }

        // Return the data directly (Spotify API returns paginated album list)
        return getToolResultSuccess(data);
      } catch (error) {
        console.error("Error fetching Spotify artist albums:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch Spotify artist albums",
        );
      }
    },
  );
}
