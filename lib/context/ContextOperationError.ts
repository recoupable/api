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
      "Check request_id, brief_id, execution_id or review_id and the organization_id scope; records in another workspace are not visible.",
  },
  conflict: {
    message: "The operation conflicts with saved state.",
    retryable: false,
    guidance:
      "Reuse an idempotency_key only with identical input and send a new key for new input. Reload the current record before reviewing it again.",
  },
  unsupported_input: {
    message: "The input is not supported by this operation.",
    retryable: false,
    guidance:
      "Submit a public Spotify track URL for ingest or a Spotify album URL for ingest_release, and check the action's documented inputs. YouTube, playlist and other sources are not enabled in this pilot.",
  },
  not_ready: {
    message: "The context request is not ready for this action.",
    retryable: true,
    guidance:
      "Read the request and retry once its status is completed or partial; a partial status still exposes output.gaps and the evidence collected so far.",
  },
  unavailable: {
    message: "A required provider or capability is unavailable.",
    retryable: true,
    guidance:
      "Retry later with the same input and idempotency_key; no duplicate work is created. The capability may be disabled in this environment.",
  },
  budget_exhausted: {
    message: "The authorized budget for this operation is exhausted.",
    retryable: false,
    guidance:
      "No paid work was started. Increase the available budget or credits, then retry with the same idempotency_key.",
  },
  storage_failed: {
    message: "Context storage rejected the operation.",
    retryable: true,
    guidance:
      "Retry with the same input and idempotency_key. If it repeats, read the request to confirm its saved state before changing input.",
  },
  internal: {
    message: "Context operation failed.",
    retryable: false,
    guidance:
      "Confirm the saved state with read before changing input; an identical retry with the same idempotency_key never duplicates work.",
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
