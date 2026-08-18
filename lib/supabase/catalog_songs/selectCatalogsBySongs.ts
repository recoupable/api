import supabase from "../serverClient";

export type CatalogSummary = {
  id: string;
  name: string;
  updated_at: string;
};

/** PostgREST `in` filters ride the URL, so large ISRC lists are chunked. */
const CHUNK_SIZE = 200;

/**
 * Select the distinct catalogs containing any of the given songs, via
 * `catalog_songs` with the `catalogs` join. This is the artist-facing catalog
 * relationship: a catalog is "connected to" an artist through the songs that
 * credit them.
 *
 * @param isrcs - Song ISRCs to look up.
 * @returns Distinct catalogs, deduped across chunks.
 */
export async function selectCatalogsBySongs(isrcs: string[]): Promise<CatalogSummary[]> {
  if (!isrcs.length) return [];

  const byId = new Map<string, CatalogSummary>();
  for (let i = 0; i < isrcs.length; i += CHUNK_SIZE) {
    const chunk = isrcs.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("catalog_songs")
      .select("catalog, catalogs!inner (id, name, updated_at)")
      .in("song", chunk);

    if (error) {
      throw new Error(`Failed to fetch catalog_songs: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (!byId.has(row.catalogs.id)) byId.set(row.catalogs.id, row.catalogs);
    }
  }

  return [...byId.values()];
}
