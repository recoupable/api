import { ContextIngestFailure, type ContextIngestFailureCode } from "./ContextIngestFailure";

// Exact exceptions authored by commit_spotify_context, as wrapped by callContextRpc.
const identityConflicts = new Set([
  "Context storage operation failed: Conflicting recording identity",
  "Context storage operation failed: Conflicting artist identity",
  "Context storage operation failed: Recording mismatch",
]);

/**
 * Preserve provider-boundary classifications and exact storage identity conflicts only.
 * Unscoped schema, syntax, authorization and timeout errors cannot establish a provider cause.
 * No private diagnostic text or logging leaves this classifier.
 */
export function classifyContextIngestFailure(error: unknown): ContextIngestFailureCode {
  if (error instanceof ContextIngestFailure) return error.code;
  if (error instanceof Error && identityConflicts.has(error.message)) return "identity_conflict";
  return "unknown";
}
