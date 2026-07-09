import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

// PostgREST encodes .in() filters in the query string — chunk so large
// catalogs (1,000+ ISRCs) can't overflow the URL.
const CHUNK_SIZE = 200;

/**
 * Select song_artists rows for a batch of song ISRCs.
 *
 * @param songs - The song ISRCs to fetch artist links for
 * @returns The matching rows, or [] if none exist or on error
 */
export async function selectSongArtistsBySongs(songs: string[]): Promise<Tables<"song_artists">[]> {
  if (songs.length === 0) return [];

  const rows: Tables<"song_artists">[] = [];
  for (let i = 0; i < songs.length; i += CHUNK_SIZE) {
    const chunk = songs.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.from("song_artists").select("*").in("song", chunk);

    if (error) {
      console.error("Error fetching song_artists:", error);
      return [];
    }

    rows.push(...(data ?? []));
  }

  return rows;
}
