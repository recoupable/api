export type SearchTrack = {
  id: number | string;
  name?: string;
  artist_names?: string[];
};

type PickBestTrackMatchParams = {
  tracks: SearchTrack[];
  q: string;
  artist?: string;
};

/**
 * Picks the best-matching track from a Chartmetric search result set.
 *
 * Ranking:
 * 1. If `artist` is supplied, drop candidates whose `artist_names` don't contain
 *    `artist` (case-insensitive substring match). Returns `undefined` if none
 *    remain — the handler turns that into a 404.
 * 2. Within the remaining pool, prefer a track whose `name` equals `q` (case
 *    insensitive, trimmed) — this disambiguates `"God's Plan"` from a track
 *    merely named `"God's"`.
 * 3. Otherwise return the first remaining track.
 *
 * @returns The best matching track, or `undefined` if the pool is empty after
 *   filtering.
 */
export function pickBestTrackMatch({
  tracks,
  q,
  artist,
}: PickBestTrackMatchParams): SearchTrack | undefined {
  let pool = tracks;

  if (artist) {
    const needle = artist.trim().toLowerCase();
    pool = tracks.filter(t => (t.artist_names ?? []).some(n => n.toLowerCase().includes(needle)));
    if (pool.length === 0) return undefined;
  }

  if (pool.length === 0) return undefined;

  const qLower = q.trim().toLowerCase();
  const exact = pool.find(t => t.name?.trim().toLowerCase() === qLower);
  return exact ?? pool[0];
}
