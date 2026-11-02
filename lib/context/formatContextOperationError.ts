import { getContextFailureMessage } from "./getContextFailureMessage";
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
export function formatContextOperationError(error: ContextOperationError, action?: string) {
  const keyed =
    action &&
    [
      "ingest",
      "ingest_catalog",
      "ingest_artist",
      "ingest_songwriter_name",
      "ingest_company_name",
      "ingest_campaign_brief",
      "ingest_supporting_text",
      "ingest_release",
      "save_brief",
      "review_release_case",
      "attach_evidence",
      "save_catalog_case",
    ].includes(action);
  const retryGuidance = keyed
    ? action === "attach_evidence" || action === "save_catalog_case"
      ? getContextFailureMessage(action)
      : "For an uncertain write, reuse the same idempotency key and unchanged input. Check saved state first; a new key is a new request, not a safe retry."
    : "";
  return {
    status: statusByCode[error.code],
    body: {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      guidance: [error.guidance, retryGuidance].filter(Boolean).join(" "),
    },
  };
}
