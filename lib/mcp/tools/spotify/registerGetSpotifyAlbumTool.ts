import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getAlbum from "@/lib/spotify/getAlbum";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifyAlbumSchema = z.object({
  id: z.string().min(1, "Album ID is required"),
  market: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code"),
});

type GetSpotifyAlbumArgs = z.infer<typeof getSpotifyAlbumSchema>;

/**
 * Registers the "get_spotify_album" tool on the MCP server.
 * Retrieve Spotify catalog information for a single album.
 * You should call get_spotify_artist_albums or get_spotify_search first in order to get an album ID to use in the tool call.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifyAlbumTool(server: McpServer): void {
  server.registerTool(
    "get_spotify_album",
    {
      description:
        "Retrieve Spotify catalog information for a single album. You should call get_spotify_artist_albums or get_spotify_search first in order to get an album ID to use in the tool call.",
      inputSchema: getSpotifyAlbumSchema,
    },
    async (args: GetSpotifyAlbumArgs) => {
      try {
        // Generate Spotify access token
        const tokenResult = await generateAccessToken();

        if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
          return getToolResultError("Failed to generate Spotify access token");
        }

        // Call Spotify API to get album
        const { album, error } = await getAlbum({
          id: args.id,
          market: args.market,
          accessToken: tokenResult.access_token,
        });

        if (error || !album) {
          return getToolResultError(error?.message || "Failed to fetch Spotify album");
        }

        // Return the album data directly
        return getToolResultSuccess(album);
      } catch (error) {
        console.error("Error fetching Spotify album:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch Spotify album",
        );
      }
    },
  );
}
