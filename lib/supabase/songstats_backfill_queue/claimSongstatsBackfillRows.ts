import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Atomically claim a batch of pending backfill rows in rank order via the
 * claim_songstats_backfill_rows RPC (FOR UPDATE SKIP LOCKED — concurrent
 * workers skip each other's locked rows). Claimed rows are already marked
 * in_progress when returned.
 *
 * @param batchSize - Max rows to claim
 * @returns The claimed rows, or [] when the queue is drained or on error
 */
export async function claimSongstatsBackfillRows(
  batchSize: number,
): Promise<Tables<"songstats_backfill_queue">[]> {
  const { data, error } = await supabase.rpc("claim_songstats_backfill_rows", {
    batch_size: batchSize,
  });

  if (error) {
    console.error("Error claiming songstats backfill rows:", error);
    return [];
  }

  return data || [];
}
