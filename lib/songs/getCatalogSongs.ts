import { selectCatalogSongs } from "@/lib/supabase/catalog_songs/selectCatalogSongs";

/** PostgREST `in` filters ride the URL, so large ISRC lists are chunked. */
const CHUNK_SIZE = 200;

/**
 * The (catalog, song) pairs for the given song ISRCs — the grouping step
 * between an artist's credited songs and the catalogs that hold them.
 *
 * @param isrcs - Song ISRCs to look up.
 * @returns Rows of catalog id + song ISRC.
 */
export async function getCatalogSongs(
  isrcs: string[],
): Promise<Array<{ catalog: string; song: string }>> {
  if (!isrcs.length) return [];

  const rows: Array<{ catalog: string; song: string }> = [];
  for (let i = 0; i < isrcs.length; i += CHUNK_SIZE) {
    rows.push(...(await selectCatalogSongs(isrcs.slice(i, i + CHUNK_SIZE))));
  }
  return rows;
}
