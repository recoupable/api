import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

// PostgREST encodes .in() filters in the query string — chunk so large
// inputs (1,000+ ISRCs) can't overflow the URL.
const CHUNK_SIZE = 200;

/**
 * Select song_artists rows filtered by song ISRCs or artist account IDs.
 *
 * Provide exactly one of `songs` or `artists` (songs takes precedence if both
 * are given). The filter list is chunked to keep `.in()` within URL limits.
 *
 * @param params.songs - Song ISRCs to match on the `song` column
 * @param params.artists - Artist account IDs to match on the `artist` column
 * @returns The matching rows, or null on query error
 */
export async function selectSongArtists(params: {
  songs?: string[];
  artists?: string[];
}): Promise<Tables<"song_artists">[] | null> {
  const { songs, artists } = params;
  const column = songs ? "song" : artists ? "artist" : null;
  const values = songs ?? artists;

  if (!column || !values) {
    throw new Error("Must provide either songs or artists");
  }
  if (values.length === 0) return [];

  const rows: Tables<"song_artists">[] = [];
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.from("song_artists").select("*").in(column, chunk);

    if (error) {
      console.error("Error fetching song_artists:", error);
      return null;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}
