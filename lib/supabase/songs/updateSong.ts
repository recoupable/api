import supabase from "../serverClient";
import type { TablesUpdate } from "@/types/database.types";

/**
 * Update a song row by ISRC.
 *
 * @param isrc - The song's ISRC.
 * @param update - Columns to set.
 * @throws Error if the update fails.
 */
export async function updateSong(isrc: string, update: TablesUpdate<"songs">): Promise<void> {
  const { error } = await supabase.from("songs").update(update).eq("isrc", isrc);

  if (error) {
    throw new Error(`Failed to update songs row ${isrc}: ${error.message}`);
  }
}
