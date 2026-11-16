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
    guidance: "Check the authenticated account and current organization access before retrying.",
  },
  not_found: {
    message: "Context record not found in the selected workspace.",
    retryable: false,
    guidance:
      "Check the record ID and workspace scope. This response does not distinguish a missing record from one outside your access.",
  },
  conflict: {
    message: "The operation conflicts with saved state.",
    retryable: false,
    guidance: "Read the current record and resolve the conflict before changing input.",
  },
  unsupported_input: {
    message: "The input is not supported by this operation.",
    retryable: false,
    guidance: "Check the action's documented fields, supported sources and limits before retrying.",
  },
  not_ready: {
    message: "The context request is not ready for this action.",
    retryable: true,
    guidance:
      "Read the request and retry only after the required state is reached. Inspect partial results and coverage gaps before using them.",
  },
  unavailable: {
    message: "A required dependency or capability is unavailable.",
    retryable: true,
    guidance:
      "Retry later with unchanged input after the dependency recovers or the capability becomes available. Retry eligibility is not a guarantee of recovery.",
  },
  budget_exhausted: {
    message: "The authorized budget for this operation is exhausted.",
    retryable: false,
    guidance:
      "Check the operation's authorized budget and saved state before proceeding. This reserved code does not establish whether work has run or charges occurred.",
  },
  storage_failed: {
    message: "Context storage could not complete the operation.",
    retryable: false,
    guidance:
      "Check the saved state before changing input. The storage failure is not recognized as transient; do not automatically retry it.",
  },
  internal: {
    message: "Context operation failed.",
    retryable: false,
    guidance:
      "Check the saved state before changing input. Do not automatically retry an unclassified failure.",
  },
};

/**
 * Transport-neutral failure of the shared Context operation. The public message and
 * guidance are authored here per code; the original error stays on `cause` for in-process use only. It must never be logged or
 * returned to HTTP or MCP callers.
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
