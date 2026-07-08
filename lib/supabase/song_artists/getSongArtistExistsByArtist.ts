import supabase from "../serverClient";

/**
 * Check whether any song_artists rows reference the given artist account.
 *
 * Used as a hard-delete guard: on query error this fails safe and returns
 * true so callers never treat an unknown state as "no dependencies".
 *
 * @param artistId - Artist account ID to check
 * @returns True if at least one song_artists row exists (or the check failed)
 */
export async function getSongArtistExistsByArtist(artistId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("song_artists")
    .select("id", { count: "exact", head: true })
    .eq("artist", artistId);

  if (error) {
    console.error("Error checking song_artists for artist:", error);
    return true;
  }

  return (count ?? 0) > 0;
}
