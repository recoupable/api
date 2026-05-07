import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

interface LifecycleWakeDecision {
  shouldContinue: boolean;
  wakeAtMs?: number;
  reason?: string;
}

/**
 * Workflow step run at the top of each `sandboxLifecycleWorkflow`
 * iteration. Reads the session, decides whether to continue looping,
 * and (when continuing) returns the next wake time. Bails when a
 * concurrent kick has overwritten `lifecycle_run_id` with a different
 * value — that newer run is now responsible for the session.
 *
 * @param sessionId - The session id the workflow is tracking.
 * @param runId - The lease this workflow run owns.
 * @returns A decision object with continuation flag, wake time, and
 *   skip reason (when terminating).
 */
export async function computeLifecycleWakeDecision(
  sessionId: string,
  runId: string,
): Promise<LifecycleWakeDecision> {
  "use step";

  const rows = await selectSessions({ id: sessionId });
  const session = rows[0];
  if (!session) return { shouldContinue: false, reason: "session-not-found" };
  if (session.status === "archived" || session.lifecycle_state === "archived") {
    return { shouldContinue: false, reason: "session-archived" };
  }
  if (
    !hasRuntimeSandboxState(session.sandbox_state) ||
    (session.sandbox_state as { type?: unknown } | null)?.type !== "vercel"
  ) {
    return { shouldContinue: false, reason: "sandbox-not-operable" };
  }

  if (session.lifecycle_run_id !== null && session.lifecycle_run_id !== runId) {
    return { shouldContinue: false, reason: "run-replaced" };
  }

  return { shouldContinue: true, wakeAtMs: getLifecycleDueAtMs(session) };
}
