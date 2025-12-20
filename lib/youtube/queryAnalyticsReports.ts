import { createYouTubeAnalyticsClient } from "./createYouTubeAnalyticsClient";
import { createYouTubeAPIClient } from "./oauth-client";

export interface AnalyticsReportsResult {
  dailyRevenue: { date: string; revenue: number }[];
  totalRevenue: number;
  channelId: string;
}

/**
 * Query YouTube Analytics reports for specified metrics and date range
 *
 * @param params - { accessToken, refreshToken, startDate, endDate, metrics }
 * @param params.accessToken - YouTube access token
 * @param params.refreshToken - YouTube refresh token (optional)
 * @param params.startDate - Start date for revenue data in YYYY-MM-DD format
 * @param params.endDate - End date for revenue data in YYYY-MM-DD format
 * @param params.metrics - Metrics to query
 * @returns Analytics data with daily breakdown and totals
 */
export async function queryAnalyticsReports({
  accessToken,
  refreshToken,
  startDate,
  endDate,
  metrics,
}: {
  accessToken: string;
  refreshToken?: string;
  startDate: string;
  endDate: string;
  metrics: string;
}): Promise<AnalyticsReportsResult> {
  // Get user's channel ID first
  const youtube = createYouTubeAPIClient(accessToken, refreshToken);

  const channelResponse = await youtube.channels.list({
    part: ["id"],
    mine: true,
  });

  if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
    throw new Error(
      "No YouTube channel found for this account. Please ensure you have a YouTube channel.",
    );
  }

  const channelId = channelResponse.data.items[0].id;
  if (!channelId) {
    throw new Error(
      "Unable to retrieve channel ID. Please ensure your YouTube account is properly set up.",
    );
  }

  // Create YouTube Analytics API client
  const ytAnalytics = createYouTubeAnalyticsClient(accessToken, refreshToken);

  // Query analytics reports for the specified date range
  const response = await ytAnalytics.reports.query({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics,
    dimensions: "day",
    sort: "day",
  });

  // Process the response
  const rows = response.data.rows || [];
  if (rows.length === 0) {
    throw new Error(
      "No revenue data found. This could mean your channel is not monetized or you don't have the required Analytics scope permissions. Please ensure your channel is eligible for monetization and you've granted Analytics permissions.",
    );
  }

  // Parse daily revenue data
  const dailyRevenue = rows.map((row: (string | number)[]) => ({
    date: String(row[0]), // Day dimension (YYYY-MM-DD format)
    revenue: parseFloat(String(row[1])) || 0, // Estimated revenue
  }));

  // Calculate total revenue
  const totalRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);

  return {
    dailyRevenue,
    totalRevenue,
    channelId,
  };
}
