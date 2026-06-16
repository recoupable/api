import { start } from "workflow/api";
import { resolveScopeSongs } from "./resolveScopeSongs";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { upsertSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/upsertSongstatsBackfillQueue";
import { songstatsBackfillWorkflow } from "@/app/workflows/songstatsBackfillWorkflow";
import type { CreateMeasurementJobBody } from "./validateCreateMeasurementJobRequest";

const METRIC = "platform_displayed_play_count";
/** Max concurrent queue upserts per batch (bounds round trips on large catalogs). */
const ENQUEUE_CONCURRENCY = 25;

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

  const candidates = isrcs.filter(isrc => !alreadyBackfilled.has(isrc));
  const skipped = isrcs.length - candidates.length;

  // Enqueue in bounded-concurrency batches so a large catalog doesn't fan out
  // into N serial round trips (which would blow the route's duration budget).
  let enqueued = 0;
  for (let i = 0; i < candidates.length; i += ENQUEUE_CONCURRENCY) {
    const batch = candidates.slice(i, i + ENQUEUE_CONCURRENCY);
    await Promise.all(
      batch.map(isrc =>
        upsertSongstatsBackfillQueue({ song: isrc, rank_score: latestValue.get(isrc) ?? 0 }),
      ),
    );
    enqueued += batch.length;
  }

  // Kick the drain now instead of waiting for the daily cron. The workflow's own
  // budget gate (limit − reserve − rolling-30d ledger) means it only drains what
  // the Songstats quota allows and then stops; SKIP LOCKED claims keep it from
  // double-processing alongside the cron, which stays as the backstop. Fire-and-
  // forget — a scheduling hiccup must not fail the (already-enqueued) job.
  if (enqueued > 0) {
    try {
      await start(songstatsBackfillWorkflow);
    } catch (error) {
      console.error("[measurement-jobs] failed to kick backfill drain:", error);
    }
  }

  return { data: { status: "success", source: "historical", id: null, enqueued, skipped } };
}
