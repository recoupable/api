import { claimSongstatsBackfillRows } from "@/lib/supabase/songstats_backfill_queue/claimSongstatsBackfillRows";
import { Tables } from "@/types/database.types";

/**
 * Claim a batch of pending backfill rows from inside the workflow.
 *
 * @param batchSize - Max rows to claim
 * @returns The claimed rows (already marked in_progress)
 */
export async function claimBackfillRowsStep(
  batchSize: number,
): Promise<Tables<"songstats_backfill_queue">[]> {
  "use step";
  return claimSongstatsBackfillRows(batchSize);
}
