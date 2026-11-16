import type { ContextIngestFailureCode } from "./ContextIngestFailure";
import { classifyContextIngestFailure } from "./classifyContextIngestFailure";

const guidance: Record<ContextIngestFailureCode, string> = {
  unsupported_input:
    "Track ingestion requires a single Spotify track URL. Use ingest_release for an album locator; playlists and artist pages are not track inputs. YouTube ingestion is not enabled.",
  recording_unavailable:
    "Spotify did not return this track for this request. Check the URL and availability before deciding whether to retry or submit a different track as a new request.",
  provider_outage:
    "The Spotify metadata request was interrupted, unavailable or rate limited. Check saved state and wait for recovery before an authorized retry with unchanged input and the same idempotency key.",
  provider_rejected:
    "Spotify rejected the metadata request. Check provider access configuration and saved state before deciding whether to retry with unchanged input and the same idempotency key.",
  provider_response_invalid:
    "The Spotify response could not be validated as the requested recording metadata. Review the source and saved state before retrying; do not infer an accepted identity from this failure.",
  identity_conflict:
    "The returned recording or saved identity disagrees with this request. Review the conflict and saved state before retrying; do not substitute a relinked recording or guess artist identity.",
  unknown:
    "The extraction outcome could not be classified. Check saved state and current workspace access before deciding whether to retry. An error does not establish whether a commit completed; do not automatically resubmit with a new key.",
};

/** Existing request error field: bounded authored code/guidance only, never raw diagnostics. */
export function describeContextIngestFailure(error: unknown): string {
  const code = classifyContextIngestFailure(error);
  return `${code}: ${guidance[code]}`;
}
