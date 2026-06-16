import supabase from "../serverClient";

/** In-progress rows older than this are treated as orphaned (crashed mid-claim). */
const STALE_IN_PROGRESS_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reset reclaimable backfill rows to `pending` so the next drain retries them:
 * every `failed` row (transient upstream errors — 429/5xx/timeout — that
 * `backfillTrackStep` marks `failed`; definitive 404 no-data is marked `done`
 * and never lands here) plus any `in_progress` row orphaned by a crashed run.
 * Idempotent — safe to run before every drain. Returns the count reclaimed.
 *
 * @returns Number of rows returned to `pending`.
 */
export async function reclaimStaleBackfillRows(): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_IN_PROGRESS_MS).toISOString();

  const { data, error } = await supabase
    .from("songstats_backfill_queue")
    .update({ status: "pending" })
    .or(`status.eq.failed,and(status.eq.in_progress,updated_at.lt.${staleBefore})`)
    .select("id");

  if (error) {
    console.error("Error reclaiming stale backfill rows:", error);
    return 0;
  }

  return data?.length ?? 0;
}
