import { releaseSongstatsBackfillRows } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";

/**
 * Durable step: return unprocessed claimed rows to `pending` when the drain
 * stops early on a defer, so the next run retries them immediately instead of
 * waiting on the stale-reclaim sweep.
 *
 * @param ids - Queue row ids still `in_progress` from the aborted batch.
 */
export async function releaseClaimedRowsStep(ids: string[]): Promise<void> {
  "use step";
  if (ids.length === 0) return;
  await releaseSongstatsBackfillRows(ids);
  console.log(`[songstats-backfill] released ${ids.length} claimed rows back to pending`);
}
