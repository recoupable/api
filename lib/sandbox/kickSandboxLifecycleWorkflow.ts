import { runKick } from "@/lib/sandbox/runKick";
import type { SandboxLifecycleReason } from "@/lib/sandbox/sandboxLifecycleTypes";

interface KickInput {
  sessionId: string;
  reason: SandboxLifecycleReason;
  /**
   * Optional scheduler for the kick chain. Callers in serverless
   * contexts should pass `task => after(() => task)` (or
   * `waitUntil(task)`) so the platform keeps the function alive
   * until the chain completes — without it the chain dies when the
   * request returns. Mirrors open-agents' `scheduleBackgroundWork`
   * parameter.
   */
  scheduleBackgroundWork?: (task: Promise<void>) => void;
}

/**
 * Fire-and-forget kick of the sandbox-lifecycle workflow. Used by:
 *
 * - `POST /api/sandbox` (reason: `sandbox-created`) — register a
 *   freshly-provisioned sandbox so the workflow auto-pauses it after
 *   `SANDBOX_INACTIVITY_TIMEOUT_MS` of idle time
 * - `GET /api/sandbox/status` (reason: `status-check-overdue`) — poke
 *   the workflow when a status read sees stale lifecycle state
 *
 * Wraps `runKick` in error handling and the optional background-work
 * scheduler. `runKick` itself owns all the decision logic.
 */
export function kickSandboxLifecycleWorkflow(input: KickInput): void {
  const task = runKick({ sessionId: input.sessionId, reason: input.reason }).catch(error =>
    console.error(`[kickSandboxLifecycleWorkflow] failed for session ${input.sessionId}:`, error),
  );

  if (input.scheduleBackgroundWork) {
    input.scheduleBackgroundWork(task);
    return;
  }

  void task;
}
