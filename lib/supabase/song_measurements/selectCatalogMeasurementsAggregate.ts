import supabase from "../serverClient";

export type CatalogMeasurementsAggregate = {
  measuredSongCount: number;
  totalStreams: number;
};

/**
 * Whole-scope aggregate for a catalog's latest measurements via the
 * get_catalog_measurements_aggregate RPC: count + total streams over the
 * latest capture per ISRC, computed in a single SQL aggregate — no row cap,
 * regardless of catalog size. Optionally scoped to one artist account
 * (catalog_songs ∩ song_artists).
 *
 * @param params.catalogId - The catalog to aggregate measurements for
 * @param params.artistAccountId - Optional artist account to scope the read to
 * @returns The aggregate (zeros when nothing is measured), or null on error
 */
export async function selectCatalogMeasurementsAggregate({
  catalogId,
  artistAccountId,
}: {
  catalogId: string;
  artistAccountId?: string;
}): Promise<CatalogMeasurementsAggregate | null> {
  const { data, error } = await supabase.rpc("get_catalog_measurements_aggregate", {
    p_catalog: catalogId,
    ...(artistAccountId ? { p_artist: artistAccountId } : {}),
  });

  if (error) {
    console.error("Error aggregating catalog measurements:", error);
    return null;
  }

  const row = data?.[0];
  return {
    measuredSongCount: Number(row?.measured_song_count ?? 0),
    totalStreams: Number(row?.total_streams ?? 0),
  };
}
