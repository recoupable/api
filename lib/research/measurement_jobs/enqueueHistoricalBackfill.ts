import { resolveScopeSongs } from "./resolveScopeSongs";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue";
import type { CreateMeasurementJobBody } from "./validateCreateMeasurementJobRequest";

const METRIC = "platform_displayed_play_count";

export type EnqueueHistoricalBackfillResult = { data: unknown } | { error: string; status: number };

/**
 * `source: "historical"` path of a measurement job. Resolves the scope to song
 * ISRCs, enqueues each for Songstats deep backfill ranked by its latest known
 * count, and skips songs that already carry `songstats` history (so no track is
 * fetched from Songstats twice). Free — no credit deduction. The queue drains
 * via the daily maintenance worker.
 *
 * @param scope - The job scope (catalog_id / album_ids / isrcs)
 * @returns 202 payload with `enqueued`/`skipped`, or a 400 when nothing resolves
 */
export async function enqueueHistoricalBackfill(
  scope: CreateMeasurementJobBody["scope"],
): Promise<EnqueueHistoricalBackfillResult> {
  const isrcs = await resolveScopeSongs(scope);
  if (isrcs.length === 0) {
    return {
      error: "No recordings resolvable from the given scope — no identifier mappings exist yet",
      status: 400,
    };
  }

  const measurements = await selectSongMeasurements({
    songs: isrcs,
    platform: "spotify",
    metric: METRIC,
  });

  // rows are newest-first: the first row per song is its latest count (the rank);
  // a song is already backfilled if any of its rows is `songstats`-sourced.
  const latestValue = new Map<string, number>();
  const alreadyBackfilled = new Set<string>();
  for (const row of measurements) {
    if (!latestValue.has(row.song)) latestValue.set(row.song, Number(row.value) || 0);
    if (row.data_source === "songstats") alreadyBackfilled.add(row.song);
  }

  let enqueued = 0;
  let skipped = 0;
  for (const isrc of isrcs) {
    if (alreadyBackfilled.has(isrc)) {
      skipped += 1;
      continue;
    }
    await upsertSongstatsBackfillQueue({ song: isrc, rank_score: latestValue.get(isrc) ?? 0 });
    enqueued += 1;
  }

  return { data: { status: "success", source: "historical", id: null, enqueued, skipped } };
}
