import { getSandboxExpiresAtDate } from "@/lib/sandbox/getSandboxExpiresAtDate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

/**
 * Re-marks a session as `lifecycle_state: "active"` after a transient
 * skip during evaluation (e.g. an active chat stream took precedence
 * over hibernation, or the user extended the timing while the
 * workflow was about to pause). Refreshes `sandbox_expires_at` from
 * the live sandbox state so the row matches reality.
 *
 * @param sessionId - The session id.
 * @param sandboxState - The live `sandbox_state` JSON value.
 */
export async function restoreActiveLifecycleState(
  sessionId: string,
  sandboxState: unknown,
): Promise<void> {
  await updateSession(sessionId, {
    lifecycle_state: "active",
    lifecycle_error: null,
    sandbox_expires_at: getSandboxExpiresAtDate(sandboxState),
  });
}
