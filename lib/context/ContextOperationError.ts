/** Stable failure codes shared by HTTP, MCP and the OpenAPI contract. */
export const contextOperationErrorCodes = [
  "permission_denied",
  "not_found",
  "conflict",
  "unsupported_input",
  "not_ready",
  "unavailable",
  "budget_exhausted",
  "storage_failed",
  "internal",
] as const;

export type ContextOperationErrorCode = (typeof contextOperationErrorCodes)[number];

const contract: Record<
  ContextOperationErrorCode,
  { message: string; retryable: boolean; guidance: string }
> = {
  permission_denied: {
    message: "Access denied to the selected context owner.",
    retryable: false,
    guidance:
      "Use credentials for the account or organization that owns this context, and pass only an organization_id you are a current member of.",
  },
  not_found: {
    message: "Context record not found in the selected workspace.",
    retryable: false,
    guidance:
      "Check request_id, subject_id, brief_id, execution_id or review_id and the organization_id scope; records in another workspace are not visible.",
  },
  conflict: {
    message: "The operation conflicts with saved state.",
    retryable: false,
    guidance:
      "Read the current record first. An idempotency_key was reused with different input, a review fingerprint is stale, the saved record changed, or it is already past the state this action needs. Send identical input to reconnect, or a new idempotency_key for new input.",
  },
  unsupported_input: {
    message: "The input is not supported by this operation.",
    retryable: false,
    guidance:
      "Change the input before retrying; check the action's documented fields and limits. In this pilot ingest accepts public Spotify track URLs and ingest_release accepts Spotify album URLs; YouTube, playlist and other sources are not enabled.",
  },
  not_ready: {
    message: "The context request is not ready for this action.",
    retryable: true,
    guidance:
      "Read the request and retry this action once it reaches the required state (usually completed or partial); a partial request still exposes output.gaps and the evidence collected so far.",
  },
  unavailable: {
    message: "A required provider or capability is unavailable.",
    retryable: true,
    guidance:
      "Retry later with the same input; actions that take an idempotency_key must reuse it, so no duplicate work is created. The capability may be disabled in this environment.",
  },
  budget_exhausted: {
    message: "The authorized budget for this operation is exhausted.",
    retryable: false,
    guidance:
      "No paid work was started. Increase the available budget or credits, then retry with the same input and idempotency_key.",
  },
  storage_failed: {
    message: "Context storage rejected the operation.",
    retryable: false,
    guidance:
      "The saved state does not allow this operation as sent, so an identical retry is rejected again. Read the request or record to confirm its current state before changing input.",
  },
  internal: {
    message: "Context operation failed.",
    retryable: false,
    guidance:
      "Read the request or record to confirm its saved state before changing input. Actions that take an idempotency_key never duplicate work when retried with the same key.",
  },
};

/**
 * Transport-neutral failure of the shared Context operation. The public message and
 * guidance are authored here per code; the original error stays on `cause` for logs
 * and never reaches HTTP or MCP callers.
 */
export class ContextOperationError extends Error {
  readonly code: ContextOperationErrorCode;
  readonly retryable: boolean;
  readonly guidance: string;

  constructor(code: ContextOperationErrorCode, cause?: unknown) {
    super(contract[code].message, { cause });
    this.name = "ContextOperationError";
    this.code = code;
    this.retryable = contract[code].retryable;
    this.guidance = contract[code].guidance;
  }
}
