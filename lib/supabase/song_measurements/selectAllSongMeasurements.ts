import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

const CHUNK_SIZE = 500; // keeps the PostgREST IN clause well under URL length limits
const PAGE_SIZE = 1000; // Supabase default row cap — paginate past it explicitly

/**
 * Select every measurement for a batch of songs, newest-first per read.
 * Unlike selectSongMeasurements this read is exhaustive: the ISRC list is
 * chunked (bounded IN clause) and each chunk is paginated with .range()
 * past the Supabase 1,000-row default, so no rows are silently dropped —
 * required for catalog-scale reads (see api#757's silent 1,000-row cap).
 *
 * @param params.songs - Song ISRCs to read measurements for
 * @param params.platform - Platform filter (e.g. "spotify")
 * @param params.metric - Metric filter (e.g. "platform_displayed_play_count")
 * @returns All measurement rows (newest-first within each chunk), or [] if none exist or on error
 */
export async function selectAllSongMeasurements({
  songs,
  platform,
  metric,
}: {
  songs: string[];
  platform: string;
  metric: string;
}): Promise<Tables<"song_measurements">[]> {
  if (songs.length === 0) return [];

  const all: Tables<"song_measurements">[] = [];

  for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
    const chunk = songs.slice(i, i + CHUNK_SIZE);

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("song_measurements")
        .select("*")
        .in("song", chunk)
        .eq("platform", platform)
        .eq("metric", metric)
        .order("captured_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching song_measurements:", error);
        return [];
      }

      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }

  return all;
}
