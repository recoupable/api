import supabase from "../serverClient";
import { TablesInsert } from "@/types/database.types";

/**
 * Upsert identifier mappings, ignoring rows whose (platform, identifier_type,
 * value) already exists — one mapping per (song, platform, identifier_type, value).
 *
 * @param rows - Mapping rows to upsert
 * @throws Error if the upsert fails (mappings are load-bearing for capture)
 */
export async function upsertSongIdentifiers(
  rows: TablesInsert<"song_identifiers">[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await supabase.from("song_identifiers").upsert(rows, {
    onConflict: "song,platform,identifier_type,value",
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(`Failed to upsert song identifiers: ${error.message}`);
  }
}
