import { sleep } from "workflow";
import { clearLifecycleRunIdIfOwned } from "@/app/workflows/clearLifecycleRunIdIfOwned";
import { computeLifecycleWakeDecision } from "@/app/workflows/computeLifecycleWakeDecision";
import { runLifecycleEvaluation } from "@/app/workflows/runLifecycleEvaluation";
import { SANDBOX_LIFECYCLE_MIN_SLEEP_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import type { SandboxLifecycleReason } from "@/lib/sandbox/sandboxLifecycleTypes";

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
