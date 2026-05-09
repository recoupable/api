/**
 * Reads the runtime `expiresAt` field (epoch milliseconds) off a
 * sandbox state and converts it to an ISO-8601 string suitable for
 * persisting to `sessions.sandbox_expires_at`. Returns null when the
 * state has no `expiresAt` (paused sandboxes or empty stubs).
 *
 * @param state - The `sandbox_state` JSON value, typically from
 *   `sandbox.getState()`.
 * @returns ISO timestamp string, or null when no expiry is set.
 */
export function getSandboxExpiresAtDate(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const expiresAt = (state as { expiresAt?: unknown }).expiresAt;
  if (typeof expiresAt !== "number") return null;
  return new Date(expiresAt).toISOString();
}
