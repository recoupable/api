/**
 * Builds SongStats `/artists/catalog` query params from the public research query.
 */
export function buildArtistCatalogQuery(
  artistId: string,
  query?: Record<string, string>,
): Record<string, string> {
  const params: Record<string, string> = { songstats_artist_id: artistId };

  if (!query) return params;

  const { isPrimary, limit, offset, ...rest } = query;
  if (isPrimary !== undefined) {
    params.is_primary = isPrimary;
    params.isPrimary = isPrimary;
  }
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== "") params[key] = value;
  }

  return params;
}
