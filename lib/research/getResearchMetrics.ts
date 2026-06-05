import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

export type GetResearchMetricsParams = {
  accountId: string;
  artist: string;
  artistId?: string;
  source: string;
};

export type GetResearchMetricsResult = { data: unknown } | { error: string; status: number };

/**
 * Fetches platform-specific artist metrics directly from the research provider.
 *
 * KISS: no caching layer — the request is served synchronously from the provider.
 * If provider latency / request volume becomes a problem once the integration is
 * proven, reintroduce a cache (see closed database#29 + chat#1777).
 */
export async function getResearchMetrics(
  params: GetResearchMetricsParams,
): Promise<GetResearchMetricsResult> {
  const resolved = params.artistId ? { id: params.artistId } : await resolveArtist(params.artist);
  if ("error" in resolved) return { error: resolved.error, status: 404 };

  const path = `/artist/${resolved.id}/stat/${params.source}`;
  const result = await fetchSongstatsResearch(path, undefined);
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
