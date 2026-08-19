import supabase from "../serverClient";

/**
 * Select catalog_songs rows for the given song ISRCs.
 *
 * @param isrcs - Song ISRCs to filter on.
 * @returns Rows of catalog id + song ISRC.
 */
export async function selectCatalogSongs(
  isrcs: string[],
): Promise<Array<{ catalog: string; song: string }>> {
  const { data, error } = await supabase
    .from("catalog_songs")
    .select("catalog, song")
    .in("song", isrcs);

  if (error) {
    throw new Error(`Failed to fetch catalog_songs: ${error.message}`);
  }
  return data ?? [];
}
