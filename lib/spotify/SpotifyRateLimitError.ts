/**
 * Spotify rate limiting that survived in-process Retry-After backoff.
 * Callers in workflow steps escalate it to a durable RetryableError; plain
 * request-path callers degrade gracefully.
 */
export class SpotifyRateLimitError extends Error {
  constructor(message = "Spotify rate limited after retries") {
    super(message);
    this.name = "SpotifyRateLimitError";
  }
}
