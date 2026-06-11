const DEFAULT_TTL_HOURS = 24;

/**
 * Whether a capture is fresh enough to serve without refreshing. TTL comes
 * from `SPOTIFY_PLAYCOUNT_TTL_HOURS` (default 24h).
 *
 * @param capturedAt - ISO timestamp of the capture
 * @returns True when the capture is within the TTL window
 */
export function isFresh(capturedAt: string): boolean {
  const ttlHours = Number(process.env.SPOTIFY_PLAYCOUNT_TTL_HOURS) || DEFAULT_TTL_HOURS;
  return Date.now() - new Date(capturedAt).getTime() < ttlHours * 60 * 60 * 1000;
}
