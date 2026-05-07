import { claimSessionLifecycleRunIdIfNull } from "@/lib/supabase/sessions/claimSessionLifecycleRunIdIfNull";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

/**
 * Combiner for the two `lifecycle_run_id` claim operations. Lives in
 * `lib/sessions/` (not `lib/supabase/sessions/`) because it does not
 * directly query Supabase — it composes two underlying helpers.
 *
 * - `expected = null` (initial claim): atomic `claimSessionLifecycleRunIdIfNull`
 *   that fails when the row already has a lease.
 * - `expected = runId` (workflow refresh): plain `updateSession` write that
 *   re-asserts the current lease without a conditional WHERE. Accepts a
 *   small race where a stale-reclaim could be overwritten — the kick path
 *   (which DOES use the atomic IfNull check) remains the primary
 *   concurrency guard.
 *
 * @param sessionId - The session id to claim against.
 * @param runId - The new lease value to write.
 * @param expected - The expected current value; defaults to null.
 * @returns true on success, false when an initial claim was already taken.
 */
export async function claimSessionLifecycleRunId(
  sessionId: string,
  runId: string,
  expected: string | null = null,
): Promise<boolean> {
  if (expected === null) {
    return claimSessionLifecycleRunIdIfNull(sessionId, runId);
  }
  const updated = await updateSession(sessionId, { lifecycle_run_id: runId });
  return updated !== null;
}
