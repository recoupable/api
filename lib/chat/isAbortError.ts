/**
 * Is this the error a stream throws when its abort signal fires?
 *
 * Used by `runAgentStep` to tell a user-stop apart from a genuine failure:
 * the former is a normal end to the turn, the latter must propagate so the
 * workflow records it. Port of upstream open-agents' `isAbortError` in
 * `apps/web/app/workflows/chat.ts`.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
