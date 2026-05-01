import { getComposioClient } from "@/lib/composio/client";

export interface AnalyticsReportsResult {
  dailyRevenue: { date: string; revenue: number }[];
  totalRevenue: number;
  channelId: string;
}

interface ChannelsListResponse {
  items?: Array<{ id?: string }>;
}

interface AnalyticsReportsResponse {
  rows?: Array<[string, number]>;
}

/**
 * Query YouTube Analytics for `metrics` over `[startDate, endDate]` for the
 * channel owned by the artist's Composio-connected account.
 *
 * Goes through `composio.tools.proxy` so the access token never leaves
 * Composio — they inject auth and refresh transparently.
 */
export async function queryAnalyticsReports({
  connectedAccountId,
  startDate,
  endDate,
  metrics,
}: {
  connectedAccountId: string;
  startDate: string;
  endDate: string;
  metrics: string;
}): Promise<AnalyticsReportsResult> {
  const composio = await getComposioClient();

  const channelsResp = await composio.tools.proxyExecute({
    endpoint: "https://www.googleapis.com/youtube/v3/channels",
    method: "GET",
    connectedAccountId,
    parameters: [
      { in: "query", name: "part", value: "id" },
      { in: "query", name: "mine", value: "true" },
    ],
  });
  const channelId = (channelsResp.data as ChannelsListResponse).items?.[0]?.id;
  if (!channelId) {
    throw new Error("No YouTube channel found for this account.");
  }

  const analyticsResp = await composio.tools.proxyExecute({
    endpoint: "https://youtubeanalytics.googleapis.com/v2/reports",
    method: "GET",
    connectedAccountId,
    parameters: [
      { in: "query", name: "ids", value: `channel==${channelId}` },
      { in: "query", name: "startDate", value: startDate },
      { in: "query", name: "endDate", value: endDate },
      { in: "query", name: "metrics", value: metrics },
      { in: "query", name: "dimensions", value: "day" },
      { in: "query", name: "sort", value: "day" },
    ],
  });

  const rows = (analyticsResp.data as AnalyticsReportsResponse).rows ?? [];
  if (rows.length === 0) {
    throw new Error(
      "No revenue data found. This could mean your channel is not monetized or you don't have the required Analytics scope permissions.",
    );
  }

  const dailyRevenue = rows.map(row => ({
    date: String(row[0]),
    revenue: parseFloat(String(row[1])) || 0,
  }));
  const totalRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);

  return { dailyRevenue, totalRevenue, channelId };
}
