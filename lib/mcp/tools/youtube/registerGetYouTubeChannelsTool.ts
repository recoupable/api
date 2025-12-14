import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

const getYouTubeChannelsSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Artist account ID from the system prompt of the active artist."),
});

type GetYouTubeChannelsArgs = z.infer<typeof getYouTubeChannelsSchema>;

/**
 * Registers the "get_youtube_channels" tool on the MCP server.
 * Gets YouTube channel information for a specific account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetYouTubeChannelsTool(server: McpServer): void {
  server.registerTool(
    "get_youtube_channels",
    {
      description: "Get YouTube channel information for a specific account. ",
      inputSchema: getYouTubeChannelsSchema,
    },
    async (args: GetYouTubeChannelsArgs) => {
      try {
        if (!args.artist_account_id || args.artist_account_id.trim() === "") {
          return getToolResultError(
            "No artist_account_id provided to YouTube channels tool. The LLM must pass the artist_account_id parameter. Please ensure you're passing the current artist's artist_account_id.",
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

        const channelResult = await fetchYouTubeChannelInfo({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || "",
          includeBranding: true,
        });

        if (!channelResult.success) {
          const errorMessage =
            "error" in channelResult
              ? channelResult.error.message
              : "Failed to fetch YouTube channel information.";
          return getToolResultError(errorMessage);
        }

        return getToolResultSuccess({
          success: true,
          status: "success",
          message: "YouTube channel information retrieved successfully",
          channels: channelResult.channelData,
        });
      } catch (error) {
        console.error("Error fetching YouTube channels:", error);
        return getToolResultError(
          error instanceof Error
            ? error.message
            : "Failed to get YouTube channel information. Please call youtube_login tool first.",
        );
      }
    },
  );
}
