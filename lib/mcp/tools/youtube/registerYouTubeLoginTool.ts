import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";

const youtubeLoginSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Artist account ID from the system prompt of the active artist."),
});

type YouTubeLoginArgs = z.infer<typeof youtubeLoginSchema>;

/**
 * Registers the "youtube_login" tool on the MCP server.
 * Checks YouTube authentication status for a specific account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerYouTubeLoginTool(server: McpServer): void {
  server.registerTool(
    "youtube_login",
    {
      description:
        "Check YouTube authentication status for a specific account. " +
        "Returns authentication status and token expiry if authenticated, or clear instructions if not. " +
        "IMPORTANT: This tool requires the artist_account_id parameter. Never ask the user for this parameter. It is always passed in the system prompt.",
      inputSchema: youtubeLoginSchema,
    },
    async (args: YouTubeLoginArgs) => {
      try {
        if (!args.artist_account_id || args.artist_account_id.trim() === "") {
          return getToolResultError(
            "No artist_account_id provided to YouTube login tool. The LLM must pass the artist_account_id parameter. Please ensure you're passing the current artist's artist_account_id.",
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

        return getToolResultSuccess({
          message: "YouTube is connected for this account.",
          authenticated: true,
        });
      } catch (error) {
        console.error("Error checking YouTube authentication:", error);
        return getToolResultError(
          error instanceof Error
            ? error.message
            : "Failed to check YouTube authentication. Please try again.",
        );
      }
    },
  );
}
