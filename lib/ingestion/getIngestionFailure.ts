import { ZodError } from "zod";
/** Classify known failures without exposing input values, URLs, paths or credentials. */
export function getIngestionFailure(error: unknown) {
  const known: Record<string, [number, string]> = {
    "Source connector configuration invalid": [503, "source_configuration_invalid"],
    "Destination configuration invalid": [503, "destination_configuration_invalid"],
    "Destination identity mismatch": [409, "destination_identity_mismatch"],
    "Delivery receipt conflict": [409, "delivery_receipt_conflict"],
    "Private ingestion storage required": [503, "private_storage_required"],
    "Ingestion bucket size limit required": [503, "storage_size_limit_required"],
    "JSON body required": [400, "invalid_arguments"],
    "Invalid JSON body": [400, "invalid_arguments"],
    "Invalid ingestion query": [400, "invalid_arguments"],
    "Request too large": [413, "request_size_limit"],
    "Access denied": [403, "access_denied"],
    "Scope changed": [409, "scope_changed"],
    "Ingestion catalog conflict": [409, "catalog_conflict"],
    "Idempotency conflict": [409, "idempotency_conflict"],
    "Gold selection mismatch": [409, "gold_selection_mismatch"],
    "Artifact not ready": [409, "artifact_not_ready"],
    "Artifact conflict": [409, "artifact_conflict"],
    "Ingestion job not found": [404, "job_not_found"],
    "Invalid base64": [400, "invalid_source"],
    "Source size limit": [413, "source_size_limit"],
    "Ingestion request limit reached": [429, "rate_limited"],
  };
  const [status, reason] =
    error instanceof ZodError
      ? [400, "invalid_arguments"]
      : error instanceof Error && Object.hasOwn(known, error.message)
        ? known[error.message]
        : [503, "operation_unavailable"];
  return {
    status: status as number,
    reason: reason as string,
    message:
      status === 400
        ? "Invalid ingestion arguments"
        : status === 403
          ? "Ingestion access denied"
          : status === 413
            ? "Ingestion size limit exceeded"
            : status === 429
              ? "Too many ingestion requests. Try again shortly."
              : "Ingestion operation unavailable. Check scope, job state and configuration.",
  };
}
