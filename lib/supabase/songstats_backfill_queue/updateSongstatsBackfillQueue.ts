import supabase from "../serverClient";
import { TablesUpdate } from "@/types/database.types";

/**
 * Update a backfill queue row (mark done/failed after a claim).
 *
 * @param id - The queue row id
 * @param fields - Fields to update
 * @throws Error if the update fails
 */
export async function updateSongstatsBackfillQueue(
  id: string,
  fields: TablesUpdate<"songstats_backfill_queue">,
): Promise<void> {
  const { error } = await supabase.from("songstats_backfill_queue").update(fields).eq("id", id);

  if (error) {
    throw new Error(`Failed to update songstats backfill queue: ${error.message}`);
  }
}

/** In-progress rows older than this are treated as orphaned (crashed mid-claim). */
const STALE_IN_PROGRESS_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reset reclaimable rows to `pending` so the next drain retries them: every
 * `failed` row (transient upstream errors — `backfillTrackStep` reserves
 * `failed` for retryable 408/429/5xx; terminal no-data / permanent 4xx is
 * marked `done`) plus any `in_progress` row orphaned by a crashed run.
 * Idempotent — safe before every drain. Throws on a DB error so the caller can
 * fail loudly rather than silently skip the reclaim.
 *
 * @returns Number of rows returned to `pending`.
 * @throws Error if the update fails
 */
export async function reclaimStaleSongstatsBackfillRows(): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_IN_PROGRESS_MS).toISOString();

  const { data, error } = await supabase
    .from("songstats_backfill_queue")
    .update({ status: "pending" })
    .or(`status.eq.failed,and(status.eq.in_progress,updated_at.lt.${staleBefore})`)
    .select("id");

  if (error) {
    throw new Error(`Failed to reclaim stale songstats backfill rows: ${error.message}`);
  }

  return data?.length ?? 0;
}
