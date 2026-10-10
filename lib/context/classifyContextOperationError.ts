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
    ),
  },
  {
    code: "conflict",
    matches: includes("already used for different", " conflict", "Evidence changed;"),
  },
  { code: "conflict", matches: startsWith("Destination request busy", "Release target changed") },
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
  { code: "not_ready", matches: includes("is not ready", "not complete", "are unavailable") },
  { code: "unavailable", matches: includes("is not enabled", "not configured", "unavailable") },
];

/**
 * Convert any thrown value from the shared Context operation into a typed error. Typed
 * errors pass through; a Zod failure here is an internal prerequisite-shape mismatch
 * (both transports validate caller input first), so it reports not_ready. Raw
 * database and provider diagnostics are matched but never copied into the result.
 */
export function classifyContextOperationError(error: unknown): ContextOperationError {
  if (error instanceof ContextOperationError) return error;
  if (error instanceof z.ZodError) return new ContextOperationError("not_ready", error);
  if (!(error instanceof Error)) return new ContextOperationError("internal", error);
  const stored = error.message.startsWith(storagePrefix);
  const message = stored ? error.message.slice(storagePrefix.length) : error.message;
  const rule = rules.find(candidate => candidate.matches(message));
  if (rule) return new ContextOperationError(rule.code, error);
  return new ContextOperationError(stored ? "storage_failed" : "internal", error);
}
