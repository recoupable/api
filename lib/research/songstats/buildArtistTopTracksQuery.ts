/**
 * Builds SongStats `/artists/top_tracks` query params.
 */
export function buildArtistTopTracksQuery(
  artistId: string,
  query?: Record<string, string>,
): Record<string, string> {
  const params: Record<string, string> = {
    songstats_artist_id: artistId,
    source: query?.source ?? "spotify",
  };

  if (!query) return params;

  const { limit, offset, source, ...rest } = query;
  if (source) params.source = source;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== "" && key !== "isPrimary") {
      params[key] = value;
    }
  }

  return params;
}
