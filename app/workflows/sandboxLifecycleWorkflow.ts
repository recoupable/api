import { sleep } from "workflow";
import { canOperateOnSandbox } from "@/lib/sandbox/canOperateOnSandbox";
import { evaluateSandboxLifecycle } from "@/lib/sandbox/evaluateSandboxLifecycle";
import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { SANDBOX_LIFECYCLE_MIN_SLEEP_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import { claimSessionLifecycleRunId } from "@/lib/supabase/sessions/claimSessionLifecycleRunId";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxLifecycleReason } from "@/lib/sandbox/sandboxLifecycleTypes";

interface LifecycleWakeDecision {
  shouldContinue: boolean;
  wakeAtMs?: number;
  reason?: string;
}

async function computeLifecycleWakeDecision(
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
    !canOperateOnSandbox(session.sandbox_state) ||
    (session.sandbox_state as { type?: unknown } | null)?.type !== "vercel"
  ) {
    return { shouldContinue: false, reason: "sandbox-not-operable" };
  }

  // Refresh the lease — anyone else who claimed it in the meantime wins.
  const claimed = await claimSessionLifecycleRunId(sessionId, runId, runId);
  if (!claimed) return { shouldContinue: false, reason: "run-replaced" };

  return { shouldContinue: true, wakeAtMs: getLifecycleDueAtMs(session) };
}

async function runLifecycleEvaluation(sessionId: string, reason: SandboxLifecycleReason) {
  "use step";
  return evaluateSandboxLifecycle(sessionId, reason);
}

async function clearLifecycleRunIdIfOwned(sessionId: string, runId: string): Promise<void> {
  "use step";

  const rows = await selectSessions({ id: sessionId });
  const session = rows[0];
  if (!session || session.lifecycle_run_id !== runId) return;

  await updateSession(sessionId, { lifecycle_run_id: null });
}

/**
 * Vercel Workflow that pauses idle sandboxes. Runs as a `while(true)`
 * loop: compute next wake time → `sleep(date)` → evaluate → either
 * loop (when not-due-yet or active-stream defers) or terminate
 * (hibernated / failed / sandbox gone). Holds the
 * `lifecycle_run_id` lease throughout so concurrent kicks can't
 * spawn duplicate workflows.
 */
export async function sandboxLifecycleWorkflow(
  sessionId: string,
  reason: SandboxLifecycleReason,
  runId: string,
) {
  "use workflow";

  while (true) {
    const decision = await computeLifecycleWakeDecision(sessionId, runId);
    if (!decision.shouldContinue || decision.wakeAtMs === undefined) {
      await clearLifecycleRunIdIfOwned(sessionId, runId);
      return { skipped: true, reason: decision.reason ?? "no-decision" };
    }

    const wakeAtMs = Math.max(decision.wakeAtMs, Date.now() + SANDBOX_LIFECYCLE_MIN_SLEEP_MS);
    await sleep(new Date(wakeAtMs));

    const evaluation = await runLifecycleEvaluation(sessionId, reason);

    if (
      evaluation.action === "skipped" &&
      (evaluation.reason === "not-due-yet" || evaluation.reason === "active-workflow")
    ) {
      continue;
    }

    await clearLifecycleRunIdIfOwned(sessionId, runId);
    return { skipped: false, evaluation };
  }
}
