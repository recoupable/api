import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upserts songs (inserts if new, updates if exists)
 *
 * @param songs - The songs to upsert
 * @returns The upserted songs
 * @throws Error if the upsert fails
 */
export async function upsertSongs(songs: TablesInsert<"songs">[]): Promise<Tables<"songs">[]> {
  const { data, error } = await supabase
    .from("songs")
    .upsert(songs, { onConflict: "isrc" })
    .select();

  if (error) {
    throw new Error(`Failed to upsert songs: ${error.message}`);
  }

  return data || [];
}
