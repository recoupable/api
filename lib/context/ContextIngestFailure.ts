export type ContextIngestFailureCode =
  | "unsupported_input"
  | "recording_unavailable"
  | "provider_outage"
  | "provider_rejected"
  | "provider_response_invalid"
  | "identity_conflict"
  | "unknown";

/** A classified ingest failure. The code names a recoverable state; the message never carries a provider body. */
export class ContextIngestFailure extends Error {
  readonly code: ContextIngestFailureCode;
  constructor(code: ContextIngestFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ContextIngestFailure";
    this.code = code;
  }
}
