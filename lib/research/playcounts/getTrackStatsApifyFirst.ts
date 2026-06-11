import {
  getResearchTrackStats,
  GetResearchTrackStatsParams,
  GetResearchTrackStatsResult,
} from "@/lib/research/getResearchTrackStats";
import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";
import { trackStatsPayloadSchema } from "@/lib/research/playcounts/trackStatsPayloadSchema";
import { labelSongstatsProvenance } from "@/lib/research/labelSongstatsProvenance";
import { deductCredits } from "@/lib/research/deductCredits";

/**
 * Apify-first routing for per-track current stats (recoupable/chat#1791),
 * layered over the untouched Songstats passthrough. When the request carries
 * an `isrc` and asks for `spotify`, that entry is served from the measurement
 * store; {@link getResearchTrackStats} covers the remaining sources and is
 * the automatic fallback when the store can't answer. The Songstats payload
 * is zod-validated once here — downstream transforms are fully typed — and a
 * non-conforming payload (shape drift) passes through unlabeled rather than
 * failing the response. Every stat entry carries `data_source` provenance per
 * the contract (docs#238).
 */
export async function getTrackStatsApifyFirst(
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

  const result = await getResearchTrackStats({
    ...params,
    params: { ...params.params, source: remainingSources.join(",") },
  });
  if ("error" in result) return result;

  const parsed = trackStatsPayloadSchema.safeParse(result.data);
  if (!parsed.success) {
    console.warn("[research] unexpected Songstats stats payload shape:", parsed.error.message);
    return result;
  }

  const labeled = labelSongstatsProvenance(parsed.data);
  if (!storeStat) return { data: labeled };
  return { data: { ...labeled, stats: [...(labeled.stats ?? []), storeStat] } };
}
