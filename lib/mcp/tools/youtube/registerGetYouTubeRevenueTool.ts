import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { queryAnalyticsReports } from "@/lib/youtube/queryAnalyticsReports";
import { getDefaultDateRange } from "@/lib/youtube/getDefaultDateRange";
import { handleRevenueError } from "@/lib/youtube/handleRevenueError";

const getYouTubeRevenueSchema = z.object({
  artist_account_id: z
    .string()
    .min(1, "Artist account ID is required")
    .describe("Artist account ID from the system prompt of the active artist."),
  startDate: z
    .string()
    .optional()
    .describe(
      "Start date for revenue data in YYYY-MM-DD format. Example: '2024-01-01'. If not provided, defaults to 30 days ago.",
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      "End date for revenue data in YYYY-MM-DD format. Example: '2024-01-31'. Should be after startDate. If not provided, defaults to yesterday.",
    ),
});

type GetYouTubeRevenueArgs = z.infer<typeof getYouTubeRevenueSchema>;

/**
 * Registers the "get_youtube_revenue" tool on the MCP server.
 * Gets YouTube revenue data for a specific account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetYouTubeRevenueTool(server: McpServer): void {
  server.registerTool(
    "get_youtube_revenue",
    {
      description:
        "Youtube: Get estimated revenue data for a specific date range for a YouTube account. " +
        "The startDate and endDate parameters are optional - if not provided, it will default to the last 30 days (1 month). ",
      inputSchema: getYouTubeRevenueSchema,
    },
    async (args: GetYouTubeRevenueArgs) => {
      try {
        if (!args.artist_account_id || args.artist_account_id.trim() === "") {
          return getToolResultError(
            "No artist_account_id provided to YouTube revenue tool. The LLM must pass the artist_account_id parameter. Please ensure you're passing the current artist's artist_account_id.",
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

        // Get date range (use defaults if not provided)
        const defaultDates = getDefaultDateRange();
        const startDate = args.startDate || defaultDates.startDate;
        const endDate = args.endDate || defaultDates.endDate;

        const analyticsResult = await queryAnalyticsReports({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          startDate,
          endDate,
          metrics: "estimatedRevenue",
        });
        return getToolResultSuccess({
          success: true,
          status: "success",
          message: `YouTube revenue data retrieved successfully for ${analyticsResult.dailyRevenue.length} days. Total revenue: $${analyticsResult.totalRevenue.toFixed(2)}`,
          revenueData: {
            totalRevenue: parseFloat(analyticsResult.totalRevenue.toFixed(2)),
            dailyRevenue: analyticsResult.dailyRevenue,
            dateRange: {
              startDate,
              endDate,
            },
            channelId: analyticsResult.channelId,
            isMonetized: true,
          },
        });
      } catch (error) {
        console.error("Error fetching YouTube revenue:", error);
        return handleRevenueError(error);
      }
    },
  );
}
