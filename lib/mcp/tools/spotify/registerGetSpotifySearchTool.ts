import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

// Supported Spotify search types
const SPOTIFY_TYPES = [
  "album",
  "artist",
  "playlist",
  "track",
  "show",
  "episode",
  "audiobook",
] as const;

// Zod schema for the MCP tool - matches the original tool interface
const getSpotifySearchSchema = z.object({
  name: z.string().min(1, "Search query is required"),
  type: z.array(z.enum(SPOTIFY_TYPES)).min(1, "At least one type is required"),
  limit: z.number().min(1).max(50).optional().default(5),
});

type GetSpotifySearchArgs = z.infer<typeof getSpotifySearchSchema>;

/**
 * Registers the "get_spotify_search" tool on the MCP server.
 * Search for Spotify items (artist, album, track, playlist, etc.) by name.
 * Returns results for each requested type.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetSpotifySearchTool(server: McpServer): void {
  server.registerTool(
    "get_spotify_search",
    {
      description:
        "Search for Spotify items (artist, album, track, playlist, etc.) by name. Returns results for each requested type.",
      inputSchema: getSpotifySearchSchema,
    },
    async (args: GetSpotifySearchArgs) => {
      try {
        // Generate Spotify access token
        const tokenResult = await generateAccessToken();

        if (!tokenResult || tokenResult.error || !tokenResult.access_token) {
          return getToolResultError("Failed to generate Spotify access token");
        }

        // Convert type array to comma-separated string for API
        const typeString = args.type.join(",");

        // Call Spotify search API
        const { data, error } = await getSearch({
          q: args.name,
          type: typeString,
          limit: args.limit,
          accessToken: tokenResult.access_token,
        });

        if (error || !data) {
          return getToolResultError(error?.message || "Failed to search Spotify");
        }

        // Filter results to only include requested types (matching original tool behavior)
        const result: Record<string, unknown> = { success: true };
        for (const t of args.type) {
          const key = `${t}s`;
          if (data[key]) {
            result[key] = data[key];
          }
        }

        return getToolResultSuccess(result);
      } catch (error) {
        console.error("Error searching Spotify:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to search Spotify",
        );
      }
    },
  );
}
