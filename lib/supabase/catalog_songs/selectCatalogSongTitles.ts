import supabase from "../serverClient";

export type CatalogSongTitle = { isrc: string; title: string | null };

/**
 * Select the ISRC + title of every song in a catalog. Lighter than
 * selectCatalogSongsWithArtists: no artists join, no pagination — used by
 * reads that only need the tracklist (e.g. catalog measurements).
 *
 * @param catalogId - The catalog to list songs for
 * @returns ISRC + title pairs, or [] if none exist or on error
 */
export async function selectCatalogSongTitles(catalogId: string): Promise<CatalogSongTitle[]> {
  const { data, error } = await supabase
    .from("catalog_songs")
    .select("songs!inner (isrc, name)")
    .eq("catalog", catalogId);

  if (error) {
    console.error("Error fetching catalog_songs:", error);
    return [];
  }

  return (data ?? []).map(row => ({ isrc: row.songs.isrc, title: row.songs.name }));
}
