import { appendPassthroughQueryParams } from "@/lib/research/songstats/appendPassthroughQueryParams";
import { resolveCatalogPrimary } from "@/lib/research/songstats/resolveCatalogPrimary";

/**
 * Builds SongStats `/artists/catalog` query params from the public research query.
 */
export function buildArtistCatalogQuery(
  artistId: string,
  query?: Record<string, string>,
): Record<string, string> {
  const isPrimary = resolveCatalogPrimary(query);
  const params: Record<string, string> = {
    songstats_artist_id: artistId,
    is_primary: isPrimary,
    isPrimary: isPrimary,
  };

  if (!query) return params;

  const { isPrimary: _ip, is_primary: _isp, limit, offset, ...rest } = query;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  appendPassthroughQueryParams(params, rest);

  return params;
}
