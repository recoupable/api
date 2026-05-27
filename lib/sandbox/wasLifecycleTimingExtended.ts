import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

/**
 * True when, between the workflow's wake-up and the moment of
 * evaluation, another caller (an `/extend` or `/activity` hit, or a
 * snapshot resume) updated the session's lifecycle timing fields and
 * the new due time is still in the future. Tells the evaluator to
 * skip hibernation this pass and let the workflow loop sleep again.
 *
 * @param sessionId - The session id.
 * @param prior - The session row read at the start of evaluation.
 * @returns true when timing was extended; false otherwise.
 */
export async function wasLifecycleTimingExtended(
  sessionId: string,
  prior: Tables<"sessions">,
): Promise<boolean> {
  const refreshed = ((await selectSessions({ id: sessionId })) ?? [])[0];
  if (!refreshed?.sandbox_state || !hasRuntimeSandboxState(refreshed.sandbox_state)) return false;

  const timingChanged =
    refreshed.last_activity_at !== prior.last_activity_at ||
    refreshed.hibernate_after !== prior.hibernate_after ||
    refreshed.sandbox_expires_at !== prior.sandbox_expires_at;

  return timingChanged && Date.now() < getLifecycleDueAtMs(refreshed);
}
