import supabase from "../serverClient";

export type CatalogSongTitle = { isrc: string; title: string | null };

const PAGE_SIZE = 1000;

/**
 * Select the ISRC + title of every song in a catalog. Lighter than
 * selectCatalogSongsWithArtists: no artists join — used by reads that only
 * need the tracklist (e.g. catalog measurements). Paginates past the
 * Supabase 1,000-row default to exhaustion so large catalogs are complete.
 *
 * @param catalogId - The catalog to list songs for
 * @returns ISRC + title pairs, or [] if none exist or on error
 */
export async function selectCatalogSongTitles(catalogId: string): Promise<CatalogSongTitle[]> {
  const all: CatalogSongTitle[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("catalog_songs")
      .select("songs!inner (isrc, name)")
      .eq("catalog", catalogId)
      .order("song", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching catalog_songs:", error);
      return [];
    }

    const rows = data ?? [];
    all.push(...rows.map(row => ({ isrc: row.songs.isrc, title: row.songs.name })));
    if (rows.length < PAGE_SIZE) return all;
  }
}
