export class ContinuationError extends Error {
  constructor(
    public readonly code:
      | "stream_continuation_upgrade_required"
      | "stream_continuation_evidence_unavailable"
      | "stream_continuation_invalid",
  ) {
    super(code);
  }
}
