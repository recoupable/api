import { connectSandbox, type SandboxState } from "@/lib/sandbox/factory";
import { clearSandboxState } from "@/lib/sandbox/clearSandboxState";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { Tables } from "@/types/database.types";
import type { Json } from "@/types/database.types";

/**
 * Fire-and-forget sandbox teardown for newly-archived sessions.
 *
 * Stops the running sandbox then clears its runtime state so the
 * auto-hibernate workflow ignores the row. When the stop fails, persists
 * a `lifecycle_error` and — if the row has no snapshot to fall back to —
 * clears the runtime sandbox state so future unarchive attempts are not
 * blocked forever by the 409 guard.
 *
 * Must be scheduled via `after()` so the HTTP response is not blocked.
 * No-ops immediately when the session has no runtime sandbox.
 *
 * @param session - The session row as it existed before archiving.
 */
export async function stopSandboxOnArchive(session: Tables<"sessions">): Promise<void> {
  if (!hasRuntimeSandboxState(session.sandbox_state)) return;

  let stopError: unknown;

  try {
    const sandbox = await connectSandbox(session.sandbox_state as unknown as SandboxState);
    await sandbox.stop();
  } catch (error) {
    stopError = error;
    console.error(`[stopSandboxOnArchive] stop failed for session ${session.id}:`, error);
  }

  try {
    const rows = await selectSessions({ id: session.id });
    const current = rows?.[0] ?? null;

    if (!current || current.status !== "archived") return;

    if (stopError !== undefined) {
      const message = stopError instanceof Error ? stopError.message : String(stopError);
      const shouldClearState =
        !current.snapshot_url && hasRuntimeSandboxState(current.sandbox_state);

      await updateSession(session.id, {
        lifecycle_error: `Archive finalization failed: ${message}`,
        lifecycle_state: "archived",
        lifecycle_run_id: null,
        sandbox_expires_at: null,
        hibernate_after: null,
        ...(shouldClearState && {
          sandbox_state: clearSandboxState(current.sandbox_state) as unknown as Json,
        }),
      });
      return;
    }

    await updateSession(session.id, {
      sandbox_state: clearSandboxState(session.sandbox_state) as unknown as Json,
    });
  } catch (error) {
    console.error(`[stopSandboxOnArchive] state update failed for session ${session.id}:`, error);
  }
}
