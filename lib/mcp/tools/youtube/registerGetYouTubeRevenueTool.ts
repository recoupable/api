import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
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
 * Registers the "get_youtube_revenue" MCP tool. Stays custom because
 * Composio's YouTube toolkit doesn't expose YouTube Analytics — this
 * tool pulls the OAuth token from the artist's Composio connection
 * and calls youtubeAnalytics.reports.query directly.
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
    async (
      args: GetYouTubeRevenueArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const callerAccountId = authInfo?.extra?.accountId;
      if (!callerAccountId) {
        return getToolResultError("Authentication required.");
      }

      const hasAccess = await checkAccountArtistAccess(callerAccountId, args.artist_account_id);
      if (!hasAccess) {
        return getToolResultError("Access denied to specified artist_account_id");
      }

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
