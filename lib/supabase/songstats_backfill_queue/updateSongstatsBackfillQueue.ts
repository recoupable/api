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
