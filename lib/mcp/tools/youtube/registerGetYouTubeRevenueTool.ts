import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getConnectors } from "@/lib/composio/connectors/getConnectors";
import { getConnectedAccountAccessToken } from "@/lib/composio/getConnectedAccountAccessToken";
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
 *
 * Composio's YouTube toolkit does not expose YouTube Analytics
 * (yt-analytics-monetary.readonly), so this tool stays as a custom
 * MCP entrypoint. It pulls the YouTube OAuth access token from the
 * artist's Composio connected account, then calls
 * youtubeAnalytics.reports.query directly.
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
        const connectors = await getConnectors(args.artist_account_id);
        const youtube = connectors.find(c => c.slug === "youtube");

        if (!youtube?.isConnected || !youtube.connectedAccountId) {
          return getToolResultError(
            "YouTube authentication required for this account. Please connect YouTube via the connectors panel.",
          );
        }

        const { accessToken, refreshToken } = await getConnectedAccountAccessToken(
          youtube.connectedAccountId,
        );

        const defaultDates = getDefaultDateRange();
        const startDate = args.startDate || defaultDates.startDate;
        const endDate = args.endDate || defaultDates.endDate;

        const analyticsResult = await queryAnalyticsReports({
          accessToken,
          refreshToken: refreshToken ?? undefined,
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
            dateRange: { startDate, endDate },
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
