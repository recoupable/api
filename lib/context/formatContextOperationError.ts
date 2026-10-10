import type { ContextOperationError, ContextOperationErrorCode } from "./ContextOperationError";

const statusByCode: Record<ContextOperationErrorCode, number> = {
  permission_denied: 403,
  not_found: 404,
  conflict: 409,
  unsupported_input: 422,
  not_ready: 409,
  unavailable: 503,
  budget_exhausted: 402,
  storage_failed: 409,
  internal: 500,
};

/** HTTP status and the documented JSON body; `error` keeps the pre-existing field for current clients. */
export function formatContextOperationError(error: ContextOperationError) {
  return {
    status: statusByCode[error.code],
    body: {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      guidance: error.guidance,
    },
  };
}
