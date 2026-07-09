import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select song_artists rows for a given artist account.
 *
 * @param artist - The artist account ID to fetch song links for
 * @returns The matching rows, or null on query error
 */
export async function selectSongArtistsByArtist(
  artist: string,
): Promise<Tables<"song_artists">[] | null> {
  const { data, error } = await supabase.from("song_artists").select("*").eq("artist", artist);

  if (error) {
    console.error("Error fetching song_artists by artist:", error);
    return null;
  }

  return data ?? [];
}
