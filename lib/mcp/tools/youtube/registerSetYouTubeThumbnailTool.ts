import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { createYouTubeAPIClient } from "@/lib/youtube/oauth-client";
import { getResizedImageBuffer } from "@/lib/youtube/getResizedImageBuffer";

const setYouTubeThumbnailSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Artist account ID from the system prompt of the active artist."),
  video_id: z
    .string()
    .min(1, "Video ID is required")
    .describe("The YouTube video ID to set the thumbnail for."),
  thumbnail_url: z
    .string()
    .url("Must be a valid URL")
    .describe(
      "A direct URL to the thumbnail image file (e.g., https://arweave.net/...). Must be a valid image URL.",
    ),
});

type SetYouTubeThumbnailArgs = z.infer<typeof setYouTubeThumbnailSchema>;

/**
 * Registers the "set_youtube_thumbnail" tool on the MCP server.
 * Sets a custom thumbnail for a YouTube video.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSetYouTubeThumbnailTool(server: McpServer): void {
  server.registerTool(
    "set_youtube_thumbnail",
    {
      description:
        "Set a custom thumbnail for a YouTube video. " +
        "Requires the artist_account_id parameter from the system prompt of the active artist, video_id, and a thumbnail_url. " +
        "Downloads the image, resizes/compresses if needed, and uploads it to YouTube using the Data API thumbnails.set endpoint. " +
        "IMPORTANT: Always call the youtube_login tool first to obtain the required authentication before calling this tool.",
      inputSchema: setYouTubeThumbnailSchema,
    },
    async (args: SetYouTubeThumbnailArgs) => {
      try {
        if (!args.artist_account_id || args.artist_account_id.trim() === "") {
          return getToolResultError(
            "No artist_account_id provided to YouTube thumbnail tool. The LLM must pass the artist_account_id parameter. Please ensure you're passing the current artist's artist_account_id.",
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

        const { buffer, error } = await getResizedImageBuffer(args.thumbnail_url);
        if (error) {
          return getToolResultError(error);
        }

        const mimeType = "image/jpeg";
        const youtube = createYouTubeAPIClient(
          tokens.access_token,
          tokens.refresh_token || undefined,
        );

        const response = await youtube.thumbnails.set({
          videoId: args.video_id,
          media: {
            mimeType,
            body: buffer,
          },
        });

        return getToolResultSuccess({
          success: true,
          status: "success",
          message: `Thumbnail set for video ${args.video_id}`,
          thumbnails: response.data.items as Array<{
            default?: { url?: string; width?: number; height?: number };
            medium?: { url?: string; width?: number; height?: number };
            high?: { url?: string; width?: number; height?: number };
            standard?: { url?: string; width?: number; height?: number };
            maxres?: { url?: string; width?: number; height?: number };
          }>,
        });
      } catch (error) {
        console.error("Error setting YouTube thumbnail:", error);
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to set video thumbnail.",
        );
      }
    },
  );
}
