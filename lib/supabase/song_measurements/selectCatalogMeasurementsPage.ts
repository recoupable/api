import supabase from "../serverClient";

export type CatalogMeasurementRow = {
  isrc: string;
  title: string | null;
  playcount: number;
  measured_at: string;
};

/**
 * One page of a catalog's latest-per-ISRC measurements via the
 * get_catalog_measurements_page RPC, sorted by play count descending.
 * Optionally scoped to one artist account (catalog_songs ∩ song_artists).
 * Pagination only windows the rows — pair with
 * selectCatalogMeasurementsAggregate for whole-scope totals.
 *
 * @param params.catalogId - The catalog to read measurements for
 * @param params.artistAccountId - Optional artist account to scope the read to
 * @param params.page - 1-based page number
 * @param params.limit - Rows per page
 * @returns The page's measurement rows ([] past the end), or null on error
 */
export async function selectCatalogMeasurementsPage({
  catalogId,
  artistAccountId,
  page,
  limit,
}: {
  catalogId: string;
  artistAccountId?: string;
  page: number;
  limit: number;
}): Promise<CatalogMeasurementRow[] | null> {
  const { data, error } = await supabase.rpc("get_catalog_measurements_page", {
    p_catalog: catalogId,
    ...(artistAccountId ? { p_artist: artistAccountId } : {}),
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });

  if (error) {
    console.error("Error fetching catalog measurements page:", error);
    return null;
  }

  return data ?? [];
}
