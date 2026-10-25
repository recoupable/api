import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";

const ENDPOINT = "https://api.linkedin.com/rest/videoAnalytics";

export type LinkedInVideoStats = {
  video_views: number | null;
  viewers: number | null;
  watch_time_ms: number | null;
};

const NO_VIDEO_STATS: LinkedInVideoStats = {
  video_views: null,
  viewers: null,
  watch_time_ms: null,
};

/**
 * A post's lifetime video numbers from LinkedIn Video Analytics, read through
 * the connection that published it, one request per metric in parallel.
 * Never throws: a rejected read (or a post without video) leaves all three
 * numbers null, and the error is logged rather than returned.
 *
 * @param connectedAccountId - The LinkedIn connection that published the post.
 * @param urn - The post's `urn:li:ugcPost:*` or `urn:li:share:*`.
 * @returns Video views, unique viewers and watch time in milliseconds.
 */
export async function getLinkedInVideoStats(
  connectedAccountId: string,
  urn: string,
): Promise<LinkedInVideoStats> {
  const read = async (type: "VIDEO_VIEW" | "VIEWER" | "TIME_WATCHED") => {
    const url = `${ENDPOINT}?q=entity&entity=${encodeURIComponent(urn)}&type=${type}&aggregation=ALL`;
    const { data } = await proxyLinkedIn(connectedAccountId, "GET", url);
    const value = ((data.elements ?? []) as { value?: unknown }[])[0]?.value;
    return typeof value === "number" ? value : null;
  };

  try {
    const [videoViews, viewers, watchTime] = await Promise.all([
      read("VIDEO_VIEW"),
      read("VIEWER"),
      read("TIME_WATCHED"),
    ]);
    return { video_views: videoViews, viewers, watch_time_ms: watchTime };
  } catch (error) {
    console.error("LinkedIn rejected the video analytics read:", error);
    return NO_VIDEO_STATS;
  }
}
