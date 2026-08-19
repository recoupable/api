import supabase from "../serverClient";

/** PostgREST `in` filters ride the URL, so large ISRC lists are chunked. */
const CHUNK_SIZE = 200;

/**
 * Select the (catalog, song) pairs for the given song ISRCs — the grouping
 * step between an artist's credited songs and the catalogs that hold them.
 *
 * @param isrcs - Song ISRCs to look up.
 * @returns Rows of catalog id + song ISRC.
 */
export async function selectCatalogSongIsrcs(
  isrcs: string[],
): Promise<Array<{ catalog: string; song: string }>> {
  if (!isrcs.length) return [];

  const rows: Array<{ catalog: string; song: string }> = [];
  for (let i = 0; i < isrcs.length; i += CHUNK_SIZE) {
    const chunk = isrcs.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("catalog_songs")
      .select("catalog, song")
      .in("song", chunk);

    if (error) {
      throw new Error(`Failed to fetch catalog_songs: ${error.message}`);
    }
    rows.push(...(data ?? []));
  }
  return rows;
}
