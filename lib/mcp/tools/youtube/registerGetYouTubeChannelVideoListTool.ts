import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { getYoutubePlaylistVideos } from "@/lib/youtube/getYoutubePlaylistVideos";

const getYouTubeChannelVideoListSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Artist account ID from the system prompt of the active artist."),
  uploads_playlist_id: z
    .string()
    .min(1, "Uploads playlist ID is required")
    .describe(
      "The YouTube channel uploads playlist ID to fetch videos for. Must be obtained via prior call to get_youtube_channels tool.",
    ),
  max_results: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(25)
    .describe("Maximum number of videos to return per page (1-50, default 25)."),
});

type GetYouTubeChannelVideoListArgs = z.infer<typeof getYouTubeChannelVideoListSchema>;

/**
 * Registers the "get_youtube_channel_video_list" tool on the MCP server.
 * Gets a list of videos for a specific YouTube channel.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetYouTubeChannelVideoListTool(server: McpServer): void {
  server.registerTool(
    "get_youtube_channel_video_list",
    {
      description:
        "Get a list of videos for a specific YouTube channel. " +
        "This tool requires the artist_account_id parameter from the system prompt of the active artist. " +
        "Returns an array of video metadata including id, title, publishedAt, thumbnails, likes, views, and more. " +
        "This tool follows YouTube API best practices by retrieving videos from the channel's uploads playlist. " +
        "IMPORTANT: Always call the youtube_login tool first to obtain the required authentication before calling this tool.",
      inputSchema: getYouTubeChannelVideoListSchema,
    },
    async (args: GetYouTubeChannelVideoListArgs) => {
      try {
        if (!args.artist_account_id || args.artist_account_id.trim() === "") {
          return getToolResultError(
            "No artist_account_id provided to YouTube channel video list tool. The LLM must pass the artist_account_id parameter. Please ensure you're passing the current artist's artist_account_id.",
          );
        }

        const tokens = await selectYouTubeTokens(args.artist_account_id);

        if (!tokens) {
          return getToolResultError(
            "YouTube authentication required for this account. Please authenticate by connecting your YouTube account.",
          );
        }

        if (isTokenExpired(tokens.expires_at)) {
          return getToolResultError(
            "YouTube access token has expired. Please re-authenticate your YouTube account.",
          );
        }

        const playlistItems = await getYoutubePlaylistVideos({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined,
          playlist_id: args.uploads_playlist_id,
          max_results: args.max_results || 25,
        });

        return getToolResultSuccess({
          success: true,
          status: "success",
          message: `Fetched ${playlistItems.videos.length} videos for channel playlist ${args.uploads_playlist_id}`,
          videos: playlistItems.videos,
          nextPageToken: playlistItems.nextPageToken,
          totalResults: playlistItems.totalResults,
          resultsPerPage: playlistItems.resultsPerPage,
        });
      } catch (error) {
        console.error("Error fetching YouTube channel video list:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch channel videos.",
        );
      }
    },
  );
}
