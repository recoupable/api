import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtistTopTracks from "@/lib/spotify/getArtistTopTracks";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifyArtistTopTracksSchema = z.object({
  id: z.string().min(1, "Artist ID is required"),
  market: z.string().length(2).optional(),
});

type GetSpotifyArtistTopTracksArgs = z.infer<typeof getSpotifyArtistTopTracksSchema>;

/**
 * Registers the "get_spotify_artist_top_tracks" tool on the MCP server.
 * Retrieve an artist's top tracks by country using the Spotify API.
 * You should call get_artist_socials or get_spotify_search first in order to get an artist ID to use in the tool call.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifyArtistTopTracksTool(server: McpServer): void {
  server.registerTool(
    "get_spotify_artist_top_tracks",
    {
      description:
        "Retrieve an artist's top tracks by country using the Spotify API. You should call get_artist_socials or get_spotify_search first in order to get an artist ID to use in the tool call.",
      inputSchema: getSpotifyArtistTopTracksSchema,
    },
    async (args: GetSpotifyArtistTopTracksArgs) => {
      try {
        // Generate Spotify access token
        const tokenResult = await generateAccessToken();

        if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
          return getToolResultError("Failed to generate Spotify access token");
        }

        // Call Spotify API to get artist top tracks
        const { data, error } = await getArtistTopTracks({
          id: args.id,
          market: args.market,
          accessToken: tokenResult.access_token,
        });

        if (error || !data) {
          return getToolResultError(error?.message || "Failed to fetch artist top tracks");
        }

        // Return the data directly (Spotify API returns { tracks: [...] })
        return getToolResultSuccess(data);
      } catch (error) {
        console.error("Error fetching artist top tracks:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch artist top tracks",
        );
      }
    },
  );
}
