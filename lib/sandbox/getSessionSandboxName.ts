/**
 * Deterministic Vercel Sandbox name for a given session id.
 *
 * The sandbox provider keys persistent sandboxes by name; deriving the
 * name from the session id makes resume idempotent — calling the create
 * endpoint twice for the same session will reconnect to the existing
 * sandbox instead of provisioning a duplicate.
 *
 * @param sessionId - The owning session id.
 * @returns The persistent sandbox name (e.g. `session-abc123`).
 */
export function getSessionSandboxName(sessionId: string): string {
  return `session-${sessionId}`;
}
