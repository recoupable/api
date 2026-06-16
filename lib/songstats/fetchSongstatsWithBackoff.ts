import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import type { ProxyResult } from "@/lib/research/ProxyResult";

// Short, in-step backoff for Songstats' per-second rate limit (total ~15s, well
// within a workflow step's duration). Persistent rejection defers the row to the
// next drain run rather than sleeping for minutes inside one invocation.
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_MS = 1000;
const DEFAULT_MAX_MS = 8_000;

/** Transient statuses worth retrying: 408 timeout, 429 rate limit, any 5xx. */
const isRetryable = (status: number) => status === 408 || status === 429 || status >= 500;

const realSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type FetchSongstatsBackoffOptions = {
  maxRetries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
};

export type BackoffResult = ProxyResult & {
  /** Total attempts made (1 + retries). */
  attempts: number;
  /** True when the final result is still retryable after exhausting retries. */
  retriesExhausted: boolean;
};

/**
 * Call Songstats with bounded exponential backoff on transient rejections
 * (429 rate limit, 408, 5xx). Retries the **same** request up to `maxRetries`
 * with `min(maxMs, baseMs * 2^attempt)` waits; a 200 or any non-retryable status
 * (e.g. 404) returns immediately. When backoff is exhausted and the call is
 * still being rejected, `retriesExhausted` is true so the caller can defer the
 * work (leave it `pending`) rather than burn it — Songstats is the rate
 * authority, not a local quota ledger.
 *
 * @param path - Songstats enterprise path (e.g. `tracks/historic_stats`).
 * @param queryParams - Query params forwarded to Songstats.
 * @param options - Backoff tuning + an injectable `sleep`.
 */
export async function fetchSongstatsWithBackoff(
  path: string,
  queryParams?: Record<string, string>,
  options: FetchSongstatsBackoffOptions = {},
): Promise<BackoffResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseMs = options.baseMs ?? DEFAULT_BASE_MS;
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS;
  const sleep = options.sleep ?? realSleep;

  let result = await fetchSongstats(path, queryParams);
  let retries = 0;
  while (isRetryable(result.status) && retries < maxRetries) {
    await sleep(Math.min(maxMs, baseMs * 2 ** retries));
    result = await fetchSongstats(path, queryParams);
    retries += 1;
  }

  return { ...result, attempts: retries + 1, retriesExhausted: isRetryable(result.status) };
}
