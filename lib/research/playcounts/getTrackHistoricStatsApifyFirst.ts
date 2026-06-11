import {
  getResearchTrackHistoricStats,
  GetResearchTrackHistoricStatsParams,
  GetResearchTrackHistoricStatsResult,
} from "@/lib/research/getResearchTrackHistoricStats";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue";
import { buildSpotifyHistoricStat } from "@/lib/research/playcounts/buildSpotifyHistoricStat";
import { historicStatsPayloadSchema } from "@/lib/research/playcounts/historicStatsPayloadSchema";
import { labelSongstatsHistoricProvenance } from "@/lib/research/labelSongstatsHistoricProvenance";
import { deductCredits } from "@/lib/research/deductCredits";

const METRIC = "platform_displayed_play_count";

/**
 * Stitched historic series for per-track stats (recoupable/chat#1791),
 * layered over the untouched Songstats passthrough. Spotify history is served
 * **from the measurement store only** — Apify snapshot captures plus
 * Songstats-backfilled points, labeled per point — and never burns Songstats
 * quota in the request path. Tracks without backfilled history return their
 * snapshot-only series and are enqueued for the backfill worker (the request
 * never blocks). Other sources delegate to {@link getResearchTrackHistoricStats}.
 */
export async function getTrackHistoricStatsApifyFirst(
  params: GetResearchTrackHistoricStatsParams,
): Promise<GetResearchTrackHistoricStatsResult> {
  const { isrc, source = "", start_date, end_date } = params.params;
  const sources = source.split(",").map(s => s.trim());
  const spotifyRequested = Boolean(isrc) && sources.includes("spotify");

  let spotifyStat = null;
  if (spotifyRequested) {
    const rows = await selectSongMeasurements({ song: isrc, platform: "spotify", metric: METRIC });
    spotifyStat = buildSpotifyHistoricStat(rows, { startDate: start_date, endDate: end_date });
    if (!rows.some(row => row.data_source === "songstats")) {
      await upsertSongstatsBackfillQueue({ song: isrc, rank_score: rows[0]?.value ?? 0 });
    }
  }

  const remainingSources = spotifyRequested ? sources.filter(s => s !== "spotify") : sources;

  if (spotifyStat && remainingSources.length === 0) {
    await deductCredits(params.accountId);
    return { data: { result: "success", stats: [spotifyStat] } };
  }

  const result = await getResearchTrackHistoricStats({
    ...params,
    params: { ...params.params, source: remainingSources.join(",") },
  });
  if ("error" in result) return result;

  const parsed = historicStatsPayloadSchema.safeParse(result.data);
  if (!parsed.success) {
    console.warn("[research] unexpected Songstats historic payload shape:", parsed.error.message);
    return result;
  }

  const labeled = labelSongstatsHistoricProvenance(parsed.data);
  if (!spotifyStat) return { data: labeled };
  return { data: { ...labeled, stats: [...(labeled.stats ?? []), spotifyStat] } };
}
