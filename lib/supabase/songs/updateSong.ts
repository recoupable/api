import supabase from "../serverClient";
import type { TablesUpdate } from "@/types/database.types";

// `artwork_url` shipped in database#58; it rides as an extra field until the
// generated types regenerate.
type SongUpdate = TablesUpdate<"songs"> & { artwork_url?: string | null };

/**
 * Update a song row by ISRC.
 *
 * @param isrc - The song's ISRC.
 * @param update - Columns to set.
 * @throws Error if the update fails.
 */
export async function updateSong(isrc: string, update: SongUpdate): Promise<void> {
  const { error } = await supabase
    .from("songs")
    .update(update as never)
    .eq("isrc", isrc);

  if (error) {
    throw new Error(`Failed to update songs row ${isrc}: ${error.message}`);
  }
}
