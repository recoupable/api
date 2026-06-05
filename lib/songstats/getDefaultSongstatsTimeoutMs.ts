const DEFAULT_SONGSTATS_TIMEOUT_MS = 10_000;
// Slow SongStats stat calls run on routes with maxDuration=60; allow most of
// that budget upstream before aborting so they don't 504 prematurely.
const SLOW_SONGSTATS_TIMEOUT_MS = 50_000;
const SLOW_SONGSTATS_PATHS = new Set([
  "artists/historic_stats",
  "artists/stats",
  "artists/top_playlists",
  "tracks/historic_stats",
  "tracks/stats",
]);

/**
 * Returns the default SongStats timeout for a path, longer for known slow paths.
 */
export function getDefaultSongstatsTimeoutMs(path: string): number {
  return SLOW_SONGSTATS_PATHS.has(path.replace(/^\/+/, ""))
    ? SLOW_SONGSTATS_TIMEOUT_MS
    : DEFAULT_SONGSTATS_TIMEOUT_MS;
}
