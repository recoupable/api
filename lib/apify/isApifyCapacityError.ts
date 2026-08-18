/**
 * Signatures Apify uses when it refuses to launch a run because the *account*
 * is saturated, rather than because the run itself failed.
 *
 * Measured 2026-08-11 on the shared account: 64GB max actor memory, 32 max
 * concurrent jobs. Each Bandsintown run takes roughly 4GB, so about 16 can be
 * in flight at once across every caller. Past that, Apify rejects with
 * "By launching this job you will exceed the memory limit of 65536MB".
 */
const CAPACITY_SIGNATURES = [
  "exceed the memory limit",
  "exceeded the maximum number of concurrent",
  "rate limit exceeded",
];

/**
 * Whether an error means "the provider is at capacity, try again later" rather
 * than "this request is broken" or "the upstream run failed".
 *
 * The distinction matters to callers: a capacity condition is retryable with
 * backoff and is not a fault in their request, so it must not be reported as a
 * 500. A failed actor run is a genuine upstream fault and stays a 500.
 *
 * @param error - Any thrown value
 * @returns True when the error is an Apify capacity rejection
 */
export function isApifyCapacityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return false;

  const haystack = message.toLowerCase();
  return CAPACITY_SIGNATURES.some(signature => haystack.includes(signature));
}
