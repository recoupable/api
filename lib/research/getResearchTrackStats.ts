import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";

export type GetResearchTrackStatsParams = {
  accountId: string;
  /** Query params forwarded verbatim to Songstats `enterprise/v1/tracks/stats`. */
  params: Record<string, string>;
};

export type GetResearchTrackStatsResult = { data: unknown } | { error: string; status: number };

/** Label every Songstats-sourced stat entry with its provenance. */
function labelSongstatsProvenance(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const payload = data as Record<string, unknown>;
  if (!Array.isArray(payload.stats)) return data;
  return {
    ...payload,
    stats: payload.stats.map(entry =>
      typeof entry === "object" && entry !== null
        ? { ...(entry as Record<string, unknown>), data_source: "songstats" }
        : entry,
    ),
  };
}

async function deductCredits(accountId: string): Promise<void> {
  try {
    await recordCreditDeduction({ accountId, creditsToDeduct: 5, source: "api" });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }
}

/**
 * Per-track, per-source current stats. Apify-first for Spotify: when the
 * request carries an `isrc` and asks for `spotify`, the entry is served from
 * the measurement store (refreshing via the play-count actor on staleness);
 * Songstats covers the remaining sources and is the automatic fallback when
 * the store can't answer. Every stat entry carries `data_source` provenance.
 * Deducts research credits only on a successful read.
 */
export async function getResearchTrackStats(
  params: GetResearchTrackStatsParams,
): Promise<GetResearchTrackStatsResult> {
  const { isrc, source = "" } = params.params;
  const sources = source.split(",").map(s => s.trim());

  const storeStat =
    isrc && sources.includes("spotify") ? await getSpotifyStatFromStore(isrc) : null;

  const remainingSources = storeStat ? sources.filter(s => s !== "spotify") : sources;

  if (storeStat && remainingSources.length === 0) {
    await deductCredits(params.accountId);
    return { data: { result: "success", stats: [storeStat] } };
  }

  const result = await fetchSongstats("tracks/stats", {
    ...params.params,
    source: remainingSources.join(","),
  });
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  await deductCredits(params.accountId);

  const labeled = labelSongstatsProvenance(result.data);
  if (!storeStat) return { data: labeled };

  const payload =
    typeof labeled === "object" && labeled !== null
      ? (labeled as Record<string, unknown>)
      : { data: labeled };
  const stats = Array.isArray(payload.stats) ? payload.stats : [];
  return { data: { ...payload, stats: [...stats, storeStat] } };
}
