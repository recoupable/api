/**
 * Query params SongStats accepts on `/artists/top_playlists` and `/tracks/top_playlists`.
 * Legacy Chartmetric filter flags are not forwarded.
 */
export function pickTopPlaylistsQuery(query?: Record<string, string>): Record<string, string> {
  return {
    ...(query?.limit ? { limit: query.limit } : {}),
    ...(query?.offset ? { offset: query.offset } : {}),
  };
}
