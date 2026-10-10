import { z } from "zod";
import { ContextOperationError, type ContextOperationErrorCode } from "./ContextOperationError";

const storagePrefix = "Context storage operation failed: "; // matched via startsWith, never emitted
const startsWith =
  (...prefixes: string[]) =>
  (message: string) =>
    prefixes.some(prefix => message.startsWith(prefix));
const includes =
  (...parts: string[]) =>
  (message: string) =>
    parts.some(part => message.includes(part));

/** Ordered; the first match wins. Matches authored API and database messages only. */
const rules: { code: ContextOperationErrorCode; matches: (message: string) => boolean }[] = [
  { code: "permission_denied", matches: startsWith("Access denied", "Case access denied") },
  { code: "permission_denied", matches: includes("not accessible", "not linked to selected") },
  {
    code: "not_found",
    matches: startsWith(
      "Context request not found",
      "Case is unavailable",
      "Case review unavailable",
      "Subject outside",
      // PostgreSQL text for an owner-scoped `select ... into strict` that matched no row.
      "query returned no rows",
    ),
  },
  {
    code: "conflict",
    matches: includes(
      "already used for different",
      " conflict",
      "Evidence changed;",
      " changed",
      "disputed",
    ),
  },
  {
    code: "conflict",
    matches: startsWith("Conflicting ", "Destination request busy", "Release target changed"),
  },
  // Server-built payloads the database re-validates; a mismatch is not the caller's input.
  { code: "internal", matches: startsWith("Invalid compiled brief") },
  {
    code: "unsupported_input",
    matches: startsWith(
      "Only Spotify tracks are enabled",
      "Use a ",
      "Unsupported ",
      "Context ingestion currently supports",
      "Invalid ",
      "A brief requires",
      "Release track lookup currently supports",
    ),
  },
  { code: "unsupported_input", matches: includes("too many") },
  { code: "not_ready", matches: includes("not ready", "not complete", "are unavailable") },
  // Transient transport or lock failures from storage; an identical retry may succeed.
  {
    code: "unavailable",
    matches: includes(
      "fetch failed",
      "statement timeout",
      "lock timeout",
      "could not serialize access",
      "deadlock detected",
    ),
  },
  { code: "unavailable", matches: includes("is not enabled", "not configured", "unavailable") },
];

/**
 * Zod failures inside the operation come from parsing stored RPC results (both transports
 * validate caller input first). A root type mismatch means the owner-scoped lookup returned
 * nothing; a `state`/`status` mismatch is a lifecycle prerequisite that has not been reached;
 * any other field means the saved record does not permit this action (for example a release
 * whose identity is already confirmed). Other root failures are internal guards.
 */
function classifyZodError(error: z.ZodError): ContextOperationErrorCode {
  const root = error.issues.filter(issue => issue.path.length === 0);
  if (root.some(issue => issue.code === "invalid_type")) return "not_found";
  if (root.length) return "internal";
  if (error.issues.some(issue => issue.path[0] === "state" || issue.path[0] === "status"))
    return "not_ready";
  return "conflict";
}

/** Codes whose cause a caller cannot act on; the cause is logged server-side for diagnosis. */
const logged: ContextOperationErrorCode[] = ["internal", "storage_failed", "unavailable"];

function classify(error: unknown): ContextOperationErrorCode {
  if (error instanceof z.ZodError) return classifyZodError(error);
  if (!(error instanceof Error)) return "internal";
  const stored = error.message.startsWith(storagePrefix);
  const message = stored ? error.message.slice(storagePrefix.length) : error.message;
  const rule = rules.find(candidate => candidate.matches(message));
  return rule?.code ?? (stored ? "storage_failed" : "internal");
}

/**
 * Convert any thrown value from the shared Context operation into a typed error. Typed
 * errors pass through. Raw database and provider diagnostics are matched but never copied
 * into the result; internal, storage and availability failures are logged with their cause.
 */
export function classifyContextOperationError(error: unknown): ContextOperationError {
  if (error instanceof ContextOperationError) return error;
  const code = classify(error);
  if (logged.includes(code)) console.error(`Context operation failed (${code})`, error);
  return new ContextOperationError(code, error);
}
