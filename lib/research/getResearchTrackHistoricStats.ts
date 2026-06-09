import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

export type GetResearchTrackHistoricStatsParams = {
  accountId: string;
  /** Query params forwarded verbatim to Songstats `enterprise/v1/tracks/historic_stats`. */
  params: Record<string, string>;
};

export type GetResearchTrackHistoricStatsResult =
  | { data: unknown }
  | { error: string; status: number };

/**
 * Thin passthrough to Songstats **Get Track Historic Stats**
 * (`GET enterprise/v1/tracks/historic_stats`) — returns a per-track, per-source
 * daily time-series of cumulative counters (incl. `streams_total`). Sibling of
 * {@link getResearchTrackStats}; no caching. Deducts research credits only on a
 * successful (200) read.
 */
export async function getResearchTrackHistoricStats(
  params: GetResearchTrackHistoricStatsParams,
): Promise<GetResearchTrackHistoricStatsResult> {
  const result = await fetchSongstats("tracks/historic_stats", params.params);
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
