import type { ContextIngestFailureCode } from "./ContextIngestFailure";
import { classifyContextIngestFailure } from "./classifyContextIngestFailure";

const guidance: Record<ContextIngestFailureCode, string> = {
  unsupported_input:
    "This URL is not a single Spotify track. Album URLs are saved with the ingest_release action; playlists, artist pages and YouTube are not enabled.",
  recording_unavailable:
    "Spotify no longer serves this track. Check the link or submit the current track URL as a new request.",
  provider_outage:
    "Spotify was unavailable or rate limited. Retry this request with the same idempotency key.",
  provider_rejected:
    "Spotify rejected the metadata request. Check provider access configuration, then retry this request with the same idempotency key.",
  provider_response_invalid:
    "Spotify returned metadata without the fields needed for a verified recording identity. No record was created; review the track on Spotify before retrying.",
  identity_conflict:
    "Existing records disagree about this recording or artist. Review the conflict before retrying; no artist record was created.",
  unknown:
    "Context extraction failed before any record was accepted. Retry this request with the same idempotency key after checking provider access.",
};

/** Persisted request error text: a stable code prefix plus recovery guidance, never a raw provider body or stack. */
export function describeContextIngestFailure(error: unknown): string {
  const code = classifyContextIngestFailure(error);
  return `${code}: ${guidance[code]}`;
}
