import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

export type GetResearchTrackStatsParams = {
  accountId: string;
  /** Query params forwarded verbatim to Songstats `enterprise/v1/tracks/stats`. */
  params: Record<string, string>;
};

export type GetResearchTrackStatsResult = { data: unknown } | { error: string; status: number };

/**
 * Thin passthrough to Songstats **Get Track Current Stats**
 * (`GET enterprise/v1/tracks/stats`) — returns per-track, per-source current
 * stats (including `streams_total`). Sibling of {@link getResearchMetrics};
 * no caching layer. Deducts research credits only on a successful (200) read.
 */
export async function getResearchTrackStats(
  params: GetResearchTrackStatsParams,
): Promise<GetResearchTrackStatsResult> {
  const result = await fetchSongstats("tracks/stats", params.params);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  try {
    await recordCreditDeduction({ accountId: params.accountId, creditsToDeduct: 5, source: "api" });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }

  return { data: result.data };
}
