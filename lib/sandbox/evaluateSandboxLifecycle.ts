import { connectSandbox } from "@/lib/sandbox/factory";
import { buildHibernatedLifecycleUpdate } from "@/lib/sandbox/buildHibernatedLifecycleUpdate";
import { clearSandboxState } from "@/lib/sandbox/clearSandboxState";
import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { getPersistentSandboxName } from "@/lib/sandbox/getPersistentSandboxName";
import { hasActiveStreamForSession } from "@/lib/sandbox/hasActiveStreamForSession";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { restoreActiveLifecycleState } from "@/lib/sandbox/restoreActiveLifecycleState";
import { wasLifecycleTimingExtended } from "@/lib/sandbox/wasLifecycleTimingExtended";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxState } from "@/lib/sandbox/factory";
import type {
  SandboxLifecycleEvaluationResult,
  SandboxLifecycleReason,
} from "@/lib/sandbox/sandboxLifecycleTypes";
import type { Json } from "@/types/database.types";

/**
 * One-shot lifecycle evaluator called by the sandbox-lifecycle
 * Vercel Workflow on each wake. Decides whether the session's
 * sandbox is past due for hibernation, and either pauses it or
 * skips with a reason for the workflow loop to act on.
 *
 * Returns:
 *   - `skipped` with a reason — workflow re-evaluates on the next
 *     iteration (for `not-due-yet`) or terminates (for terminal
 *     reasons like `session-not-found`)
 *   - `hibernated` — sandbox was stopped, session row updated
 *   - `failed` — an error occurred mid-evaluation; row's
 *     `lifecycle_state` is set to `"failed"` for self-healing on
 *     the next status read
 */
export async function evaluateSandboxLifecycle(
  sessionId: string,
  reason: SandboxLifecycleReason,
): Promise<SandboxLifecycleEvaluationResult> {
  const rows = await selectSessions({ id: sessionId });
  if (!rows) return { action: "failed", reason: "session-query-failed" };
  const session = rows[0];

  if (!session) return { action: "skipped", reason: "session-not-found" };
  if (session.status === "archived" || session.lifecycle_state === "archived") {
    return { action: "skipped", reason: "session-archived" };
  }

  const sandboxState = session.sandbox_state;
  if (!hasRuntimeSandboxState(sandboxState)) {
    return { action: "skipped", reason: "sandbox-not-operable" };
  }
  if ((sandboxState as { type?: unknown }).type !== "vercel") {
    return { action: "skipped", reason: "unsupported-sandbox-type" };
  }

  if (Date.now() < getLifecycleDueAtMs(session)) {
    return { action: "skipped", reason: "not-due-yet" };
  }

  const activeStreamBeforeHibernate = await hasActiveStreamForSession(sessionId);
  if (activeStreamBeforeHibernate === null) {
    return { action: "failed", reason: "chat-query-failed" };
  }
  if (activeStreamBeforeHibernate) {
    return { action: "skipped", reason: "active-workflow" };
  }

  try {
    await updateSession(sessionId, { lifecycle_state: "hibernating", lifecycle_error: null });

    const sandbox = await connectSandbox(sandboxState as unknown as SandboxState);

    const activeStreamBeforeStop = await hasActiveStreamForSession(sessionId);
    if (activeStreamBeforeStop === null) {
      await restoreActiveLifecycleState(sessionId, sandboxState);
      return { action: "failed", reason: "chat-query-failed" };
    }
    if (activeStreamBeforeStop) {
      await restoreActiveLifecycleState(sessionId, sandboxState);
      return { action: "skipped", reason: "active-workflow" };
    }

    if (await wasLifecycleTimingExtended(sessionId, session)) {
      const refreshedRows = await selectSessions({ id: sessionId });
      if (!refreshedRows)
        throw new Error("Failed to refresh session during lifecycle extension check");
      const refreshed = refreshedRows[0];
      if (refreshed?.sandbox_state) {
        await restoreActiveLifecycleState(sessionId, refreshed.sandbox_state);
      }
      return { action: "skipped", reason: "not-due-yet" };
    }

    await sandbox.stop();

    const cleared = clearSandboxState(sandboxState);
    await updateSession(sessionId, {
      sandbox_state: cleared as unknown as Json,
      snapshot_url: null,
      snapshot_created_at: null,
      ...buildHibernatedLifecycleUpdate(),
    });
    console.log(
      `[evaluateSandboxLifecycle] hibernated session=${sessionId} reason=${reason} sandboxName=${getPersistentSandboxName(cleared) ?? "none"}`,
    );
    return { action: "hibernated" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSession(sessionId, {
      lifecycle_state: "failed",
      lifecycle_run_id: null,
      lifecycle_error: message,
    });
    console.error(
      `[evaluateSandboxLifecycle] failed session=${sessionId} reason=${reason}:`,
      error,
    );
    return { action: "failed", reason: message };
  }
}
