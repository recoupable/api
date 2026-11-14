/** Identify the platform AbortError without interpreting why the operation stopped. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
