import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

/**
 * Workflow step that clears `lifecycle_run_id` only if it still
 * matches the supplied `runId`. Used at the end of a workflow run to
 * release the lease without clobbering one that's been reclaimed by
 * a kick.
 *
 * @param sessionId - The session id.
 * @param runId - The lease this workflow owned; only clear if it
 *   still matches.
 */
export async function clearLifecycleRunIdIfOwned(sessionId: string, runId: string): Promise<void> {
  "use step";

  const rows = await selectSessions({ id: sessionId });
  if (!rows) {
    console.error("[clearLifecycleRunIdIfOwned] DB error fetching session", sessionId);
    return;
  }
  const session = rows[0];
  if (!session || session.lifecycle_run_id !== runId) return;

  await updateSession(sessionId, { lifecycle_run_id: null });
}
