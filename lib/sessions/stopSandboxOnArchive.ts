import { connectSandbox, type SandboxState } from "@/lib/sandbox/factory";
import { clearSandboxState } from "@/lib/sandbox/clearSandboxState";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { Tables } from "@/types/database.types";
import type { Json } from "@/types/database.types";

/**
 * Fire-and-forget sandbox teardown for newly-archived sessions.
 *
 * Stops the running sandbox and marks the lifecycle as "archived" so
 * the auto-hibernate workflow does not attempt to re-evaluate it.
 * Must be scheduled via `after()` from the caller so the HTTP
 * response is not blocked.
 *
 * No-ops when the session has no runtime sandbox (nothing to stop).
 *
 * @param session - The session row as it existed before archiving.
 */
export async function stopSandboxOnArchive(session: Tables<"sessions">): Promise<void> {
  if (!hasRuntimeSandboxState(session.sandbox_state)) return;

  try {
    const sandbox = await connectSandbox(session.sandbox_state as unknown as SandboxState);
    await sandbox.stop();
    const cleared = clearSandboxState(session.sandbox_state);
    await updateSession(session.id, {
      sandbox_state: cleared as unknown as Json,
      lifecycle_state: "archived",
      lifecycle_run_id: null,
    });
  } catch (error) {
    console.error(`[stopSandboxOnArchive] failed for session ${session.id}:`, error);
  }
}
