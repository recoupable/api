import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { Tables } from "@/types/database.types";

/**
 * Clears a stale `lifecycle_run_id` lease and re-reads the row so the
 * caller has the post-clear snapshot to work with. Used by the kick
 * logic when `isLifecycleRunStale` returns true.
 *
 * @param sessionId - The session whose lease to reclaim.
 * @returns The session row with `lifecycle_run_id: null`, or null if
 *   the row vanished between the clear and the re-read.
 */
export async function reclaimStaleLease(sessionId: string): Promise<Tables<"sessions"> | null> {
  await updateSession(sessionId, { lifecycle_run_id: null });
  const rows = await selectSessions({ id: sessionId });
  return rows[0] ?? null;
}
