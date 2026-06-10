import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert measurement rows, silently skipping rows whose
 * (song, platform, metric, captured_at) capture already exists (fetch-once:
 * the store is append-only and a capture is never overwritten).
 *
 * @param measurements - The measurement rows to insert
 * @returns The inserted rows (existing duplicates are omitted)
 * @throws Error if the insert fails
 */
export async function insertSongMeasurements(
  measurements: TablesInsert<"song_measurements">[],
): Promise<Tables<"song_measurements">[]> {
  if (measurements.length === 0) return [];

  const { data, error } = await supabase
    .from("song_measurements")
    .upsert(measurements, {
      onConflict: "song,platform,metric,captured_at",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    throw new Error(`Failed to insert song measurements: ${error.message}`);
  }

  return data || [];
}
