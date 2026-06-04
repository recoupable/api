/**
 * Returns true when the error is a fetch AbortError (request timeout).
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
