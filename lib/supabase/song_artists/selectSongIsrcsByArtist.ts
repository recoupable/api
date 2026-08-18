import supabase from "../serverClient";

/**
 * Select the ISRCs of every song crediting an artist account in
 * `song_artists`. The songs graph is how catalogs relate to artists:
 * `account_catalogs` links a catalog to its owner, not its artists.
 *
 * @param artistId - The artist's account id.
 * @returns Distinct ISRCs, empty when the artist has no credited songs.
 */
export async function selectSongIsrcsByArtist(artistId: string): Promise<string[]> {
  const { data, error } = await supabase.from("song_artists").select("song").eq("artist", artistId);

  if (error) {
    console.error("Error fetching song_artists:", error);
    return [];
  }

  return [...new Set((data ?? []).map(row => row.song))];
}
