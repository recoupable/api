/**
 * Whether a Songstats response status is worth retrying with backoff.
 *
 * Transient: 408 (request timeout), 429 (rate limit), and the gateway 5xx
 * 502/503/504 (bad gateway / unavailable / gateway timeout). Deliberately
 * **excludes** 500/501 — `fetchSongstats` maps a missing API key and any
 * non-HTTP fetch failure to 500, which are permanent for that request, so
 * retrying them just burns the backoff budget before the row defers.
 *
 * @param status - HTTP status from `fetchSongstats`.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}
