import { start } from "workflow/api";
import { sandboxLifecycleWorkflow } from "@/app/workflows/sandboxLifecycleWorkflow";
import { createLifecycleRunId } from "@/lib/sandbox/createLifecycleRunId";
import { isLifecycleRunStale } from "@/lib/sandbox/isLifecycleRunStale";
import { reclaimStaleLease } from "@/lib/sandbox/reclaimStaleLease";
import { shouldStartLifecycle } from "@/lib/sandbox/shouldStartLifecycle";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxLifecycleReason } from "@/lib/sandbox/sandboxLifecycleTypes";

interface RunKickInput {
  sessionId: string;
  reason: SandboxLifecycleReason;
}

/**
 * The async chain that the lifecycle kick runs in the background:
 *
 *   1. Read the session row
 *   2. Reclaim the lease if it's stale (workflow crashed)
 *   3. Skip if the session isn't in a shape where lifecycle makes sense
 *      (`shouldStartLifecycle` already filters out rows that already
 *      have a `lifecycle_run_id` — best-effort concurrency guard)
 *   4. Generate a fresh run id and write it to the session row
 *   5. `start()` the Vercel Workflow run
 *   6. On `start()` failure, clear the lease so retry can succeed
 *
 * Errors are caught at the call site (`kickSandboxLifecycleWorkflow`)
 * and never surface to the request — this is fire-and-forget by
 * design.
 */
export async function runKick(input: RunKickInput): Promise<void> {
  const rows = await selectSessions({ id: input.sessionId });
  const session = rows[0];
  if (!session) return;

  const sessionForStart = isLifecycleRunStale(session)
    ? await reclaimStaleLease(input.sessionId)
    : session;

  if (!shouldStartLifecycle(sessionForStart)) return;

  const runId = createLifecycleRunId();
  await updateSession(input.sessionId, { lifecycle_run_id: runId });

  try {
    const run = await start(sandboxLifecycleWorkflow, [input.sessionId, input.reason, runId]);
    console.log(
      `[kickSandboxLifecycleWorkflow] started run ${run.runId} for session ${input.sessionId} (reason=${input.reason})`,
    );
  } catch (error) {
    console.error(
      `[kickSandboxLifecycleWorkflow] failed to start workflow for session ${input.sessionId}; clearing lease:`,
      error,
    );
    await updateSession(input.sessionId, { lifecycle_run_id: null });
  }
}
