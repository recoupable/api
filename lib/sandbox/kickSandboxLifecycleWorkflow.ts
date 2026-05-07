import { start } from "workflow/api";
import { sandboxLifecycleWorkflow } from "@/app/workflows/sandboxLifecycleWorkflow";
import { canOperateOnSandbox } from "@/lib/sandbox/canOperateOnSandbox";
import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { SANDBOX_LIFECYCLE_STALE_RUN_GRACE_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import { claimSessionLifecycleRunId } from "@/lib/supabase/sessions/claimSessionLifecycleRunId";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxLifecycleReason } from "@/lib/sandbox/sandboxLifecycleTypes";
import type { Tables } from "@/types/database.types";

interface KickInput {
  sessionId: string;
  reason: SandboxLifecycleReason;
}

/**
 * Fire-and-forget kick of `sandboxLifecycleWorkflow`. Used by:
 *
 * - `POST /api/sandbox` (reason: `sandbox-created`) — register a
 *   freshly-provisioned sandbox so the workflow auto-pauses it after
 *   `SANDBOX_INACTIVITY_TIMEOUT_MS` of idle time
 * - `GET /api/sandbox/status` (reason: `status-check-overdue`) — poke
 *   the workflow when a status read sees stale lifecycle state
 *
 * Skips when the session can't be acted on (archived, no runtime
 * sandbox, wrong sandbox type) or when another lifecycle run is
 * already in flight. A run that's been overdue past the grace window
 * is considered stale and gets reclaimed.
 */
export function kickSandboxLifecycleWorkflow(input: KickInput): void {
  void runKick(input).catch(error =>
    console.error(`[kickSandboxLifecycleWorkflow] failed for session ${input.sessionId}:`, error),
  );
}

async function runKick(input: KickInput): Promise<void> {
  const rows = await selectSessions({ id: input.sessionId });
  const session = rows[0];
  if (!session) return;

  const sessionForStart = isLifecycleRunStale(session)
    ? await reclaimStaleLease(input.sessionId)
    : session;

  if (!shouldStartLifecycle(sessionForStart)) return;

  const runId = createLifecycleRunId();
  const claimed = await claimSessionLifecycleRunId(input.sessionId, runId);
  if (!claimed) return;

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

async function reclaimStaleLease(sessionId: string): Promise<Tables<"sessions"> | null> {
  await updateSession(sessionId, { lifecycle_run_id: null });
  const rows = await selectSessions({ id: sessionId });
  return rows[0] ?? null;
}

function shouldStartLifecycle(session: Tables<"sessions"> | null): session is Tables<"sessions"> {
  if (!session) return false;
  if (session.status === "archived" || session.lifecycle_state === "archived") return false;
  if (!session.sandbox_state) return false;
  if (!canOperateOnSandbox(session.sandbox_state)) return false;
  if ((session.sandbox_state as { type?: unknown }).type !== "vercel") return false;
  if (session.lifecycle_run_id) return false;
  return true;
}

function isLifecycleRunStale(session: Tables<"sessions">): boolean {
  if (!session.lifecycle_run_id) return false;
  if (session.lifecycle_state !== "active") return false;
  const overdueMs = Date.now() - getLifecycleDueAtMs(session);
  return overdueMs > SANDBOX_LIFECYCLE_STALE_RUN_GRACE_MS;
}

function createLifecycleRunId(): string {
  return `lifecycle:${Date.now()}:${crypto.randomUUID()}`;
}
