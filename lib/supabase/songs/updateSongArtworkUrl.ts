import supabase from "../serverClient";

/**
 * Persist a song's Apple Music artwork URL. Part of the lazy write-through:
 * the public profile resolves artwork on first miss and stores it here so
 * later builds never call Apple for the same song.
 *
 * @param isrc - The song's ISRC.
 * @param artworkUrl - The resolved artwork URL.
 * @throws Error if the update fails (callers treat that as non-fatal).
 */
export async function updateSongArtworkUrl(isrc: string, artworkUrl: string): Promise<void> {
  const { error } = await supabase
    .from("songs")
    .update({ artwork_url: artworkUrl } as never)
    .eq("isrc", isrc);

  if (error) {
    throw new Error(`Failed to update songs.artwork_url for ${isrc}: ${error.message}`);
  }
}
