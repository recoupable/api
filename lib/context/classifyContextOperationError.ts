import { ContextOperationError, type ContextOperationErrorCode } from "./ContextOperationError";

const storagePrefix = "Context storage operation failed: ";
// Exact authored API messages only. Never classify fragments of private diagnostics.
const apiMessages: Record<string, ContextOperationErrorCode> = {
  "Access denied to context owner": "permission_denied",
  "Context owner changed": "permission_denied",
  "Material evidence owner changed": "permission_denied",
  "Catalog case workspace differs from authorized scope": "permission_denied",
  "Context request not found": "not_found",
  "Context request is not ready for a brief": "not_ready",
  "Context request is not ready for planning": "not_ready",
  "Only Spotify tracks are enabled in this pilot": "unsupported_input",
  "Use a public HTTPS Spotify track or YouTube video URL": "unsupported_input",
  "Context ingestion currently supports individual Spotify tracks": "unsupported_input",
  "Use a Spotify track or a single YouTube video URL": "unsupported_input",
  "Use a public HTTPS Spotify album URL": "unsupported_input",
  "Use a Spotify album URL, including a single's album page": "unsupported_input",
  "Spotify release track lookup is not enabled": "unavailable",
  "Spotify release verification is not enabled": "unavailable",
  "Release track dispatcher unavailable": "unavailable",
  "Release verification dispatcher unavailable": "unavailable",
  "fetch failed": "unavailable",
};
// Exact SQL-authored domain messages. Unknown rejections remain opaque and non-retryable.
const storageMessages: Record<string, ContextOperationErrorCode> = {
  "Case access denied": "permission_denied",
  "Case is unavailable": "not_found",
  "Case review unavailable": "not_found",
  "Catalog case unavailable": "not_found",
  "Catalog cursor unavailable": "not_found",
  "Catalog evidence unavailable": "not_found",
  "Idempotency key already used for different input": "conflict",
  "Brief key already used for different output": "conflict",
  "Review key already used for different input": "conflict",
  "Catalog key reused for different input": "conflict",
  "Catalog revision conflict": "conflict",
  "Evidence changed; reload before reviewing": "conflict",
  "Case evidence is not ready for review": "not_ready",
  "Invalid compiled brief": "internal",
  "Invalid brief input count": "internal",
  "Invalid brief requests": "internal",
  "Duplicate brief documents": "internal",
  "Brief manifest does not match evidence": "internal",
  "fetch failed": "unavailable",
  "canceling statement due to statement timeout": "unavailable",
  "canceling statement due to lock timeout": "unavailable",
  "could not serialize access due to concurrent update": "unavailable",
  "could not serialize access due to read/write dependencies among transactions": "unavailable",
  "deadlock detected": "unavailable",
};

/**
 * Classify without emitting private text, causes or identifiers. Stored-result schema failures
 * remain internal: an issue path alone cannot prove absence, readiness or caller conflict.
 * Generic SQL no-row failures also remain opaque without the failing lookup's provenance.
 */
export function classifyContextOperationError(error: unknown): ContextOperationError {
  if (error instanceof ContextOperationError) return error;
  if (!(error instanceof Error)) return new ContextOperationError("internal", error);
  const stored = error.message.startsWith(storagePrefix);
  const message = stored ? error.message.slice(storagePrefix.length) : error.message;
  const messages = stored ? storageMessages : apiMessages;
  const code = Object.hasOwn(messages, message)
    ? messages[message]
    : stored
      ? "storage_failed"
      : "internal";
  return new ContextOperationError(code, error);
}
