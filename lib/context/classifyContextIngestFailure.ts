import { ZodError } from "zod";
import { ContextIngestFailure, type ContextIngestFailureCode } from "./ContextIngestFailure";

// Exception messages raised by commit_spotify_context in the database repository. The RPC
// wrapper prefixes them with "Context storage operation failed: ", so match by substring.
const identityConflictMessages = [
  "Conflicting recording identity",
  "Conflicting artist identity",
  "Recording mismatch",
];
const invalidResponseMessages = ["Verified ISRC required"];

/** Map any thrown value to one recoverable ingest state. Unrelated errors stay `unknown` rather than being guessed. */
export function classifyContextIngestFailure(error: unknown): ContextIngestFailureCode {
  if (error instanceof ContextIngestFailure) return error.code;
  if (error instanceof ZodError || error instanceof SyntaxError) return "provider_response_invalid";
  if (typeof error !== "object" || error === null) return "unknown";
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "TimeoutError" || name === "AbortError") return "provider_outage";
  if (typeof message !== "string") return "unknown";
  if (identityConflictMessages.some(text => message.includes(text))) return "identity_conflict";
  if (invalidResponseMessages.some(text => message.includes(text)))
    return "provider_response_invalid";
  return "unknown";
}
