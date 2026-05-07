import { claimSessionLifecycleRunIdIfMatch } from "@/lib/supabase/sessions/claimSessionLifecycleRunIdIfMatch";
import { claimSessionLifecycleRunIdIfNull } from "@/lib/supabase/sessions/claimSessionLifecycleRunIdIfNull";

/**
 * Combiner for the two `lifecycle_run_id` claim operations. Picks the
 * right atomic Supabase write based on whether the caller is making
 * an initial claim (expected = null) or refreshing its own lease
 * (expected = the runId).
 *
 * @param sessionId - The session id to claim against.
 * @param runId - The new lease value to write.
 * @param expected - The expected current value; defaults to null.
 * @returns true on success, false when the lease was already taken.
 */
export async function claimSessionLifecycleRunId(
  sessionId: string,
  runId: string,
  expected: string | null = null,
): Promise<boolean> {
  return expected === null
    ? claimSessionLifecycleRunIdIfNull(sessionId, runId)
    : claimSessionLifecycleRunIdIfMatch(sessionId, expected);
}
