import supabase from "../serverClient";

/**
 * Return a set of claimed (`in_progress`) backfill rows to `pending` in one
 * round trip. Used when the drain stops early (a track deferred under sustained
 * rate-limiting): the rest of the already-claimed batch must go back to
 * `pending` so the next drain retries them immediately, instead of sitting
 * `in_progress` until the 1-hour stale-reclaim sweep picks them up.
 *
 * No-op on an empty list. Throws on a DB error so the caller fails loudly.
 *
 * @param ids - Queue row ids to release back to `pending`.
 * @throws Error if the update fails
 */
export async function releaseSongstatsBackfillRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("songstats_backfill_queue")
    .update({ status: "pending" })
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to release songstats backfill rows: ${error.message}`);
  }
}
