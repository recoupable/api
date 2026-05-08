/**
 * Reads the runtime `expiresAt` field (epoch ms) off a sandbox state.
 * Returns undefined when the input is not an object or when
 * `expiresAt` is missing or a non-number — so callers can treat the
 * absence of an expiry as "unknown" without coercing to NaN/0.
 *
 * Distinct from `getSandboxExpiresAtDate`, which formats the same
 * field as an ISO-8601 string for persistence to
 * `sessions.sandbox_expires_at`.
 *
 * @param state - The `sandbox_state` JSON value, typically from
 *   `sandbox.getState()` or the persisted session row.
 * @returns Epoch ms expiry, or undefined.
 */
export function getStateExpiresAt(state: unknown): number | undefined {
  if (!state || typeof state !== "object") return undefined;
  const expiresAt = (state as { expiresAt?: unknown }).expiresAt;
  return typeof expiresAt === "number" ? expiresAt : undefined;
}
