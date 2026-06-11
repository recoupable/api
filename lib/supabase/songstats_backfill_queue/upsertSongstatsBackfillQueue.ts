import supabase from "../serverClient";

/**
 * Enqueue a song for Songstats historic backfill. Idempotent: an existing
 * queue row for the song wins (its rank/status are preserved). Errors are
 * logged, never thrown — enqueueing is a side effect of read requests and
 * must never fail them.
 *
 * @param row.song - The song ISRC
 * @param row.rank_score - Backfill priority (all-time play count)
 */
export async function upsertSongstatsBackfillQueue(row: {
  song: string;
  rank_score: number;
}): Promise<void> {
  const { error } = await supabase
    .from("songstats_backfill_queue")
    .upsert([row], { onConflict: "song", ignoreDuplicates: true });

  if (error) {
    console.error("Error enqueueing songstats backfill:", error);
  }
}
