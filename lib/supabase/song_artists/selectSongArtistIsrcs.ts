import supabase from "../serverClient";

const PAGE_SIZE = 1000;

/**
 * Select the ISRC of every song linked to an artist account via
 * song_artists. Paginates past the Supabase 1,000-row default to
 * exhaustion so large discographies are complete — used to scope catalog
 * measurement reads to one artist.
 *
 * @param artistAccountId - The artist account to list linked songs for
 * @returns Song ISRCs, or [] if none exist or on error
 */
export async function selectSongArtistIsrcs(artistAccountId: string): Promise<string[]> {
  const all: string[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("song_artists")
      .select("song")
      .eq("artist", artistAccountId)
      .order("song", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching song_artists:", error);
      return [];
    }

    const rows = data ?? [];
    all.push(...rows.map(row => row.song));
    if (rows.length < PAGE_SIZE) return all;
  }
}
