/**
 * Returns true when `sandbox_state` carries actual runtime metadata
 * (i.e. a sandbox has been provisioned and bound to the session) rather
 * than the type-only stub written at session creation.
 *
 * `POST /api/sessions` (api PR #515) inserts `sandbox_state` as
 * `{ type: "vercel" }` — a type discriminator with no runtime data.
 * Callers must NOT treat this stub as evidence of a live sandbox; doing
 * so causes `GET /api/sandbox/status` to report `"active"` immediately
 * after session creation, which defeats the chat loading-state UX.
 *
 * Runtime presence is currently keyed off a non-empty `sandboxName` —
 * `POST /api/sandbox` writes this via `getSessionSandboxName(sessionId)`
 * and the abstraction's `connectSandbox(...).getState()` preserves it.
 *
 * @param state - The persisted `sandbox_state` JSON column value.
 * @returns true when the state has real runtime metadata; false for
 *   null/undefined, scalars, the empty type stub, or empty sandboxName.
 */
export function hasRuntimeSandboxState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  const candidate = state as { sandboxName?: unknown };
  return typeof candidate.sandboxName === "string" && candidate.sandboxName.length > 0;
}
