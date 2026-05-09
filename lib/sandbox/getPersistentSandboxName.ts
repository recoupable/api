/**
 * Reads the durable `sandboxName` from a `sandbox_state` JSON value.
 * Returns null when the state has no `sandboxName` (or it's empty).
 *
 * The `sandboxName` is the deterministic identifier under which a
 * sandbox is registered with the Vercel sandbox runtime — assigned at
 * creation time via `getSessionSandboxName(sessionId)` and preserved
 * across resume / pause / restore cycles. It survives even when the
 * runtime metadata (expiresAt, etc.) has been cleared.
 *
 * @param state - The persisted `sandbox_state` JSON value.
 * @returns The persistent sandbox name, or null when absent.
 */
export function getPersistentSandboxName(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const candidate = state as { sandboxName?: unknown };
  return typeof candidate.sandboxName === "string" && candidate.sandboxName.length > 0
    ? candidate.sandboxName
    : null;
}
