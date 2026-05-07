import supabase from "@/lib/supabase/serverClient";

/**
 * Atomic Supabase write: refreshes `lifecycle_run_id` for a session
 * only if the row's current value MATCHES the supplied value. Returns
 * true on successful refresh, false if the row was reclaimed by
 * someone else. Used by the workflow to confirm it still owns its
 * lease before each evaluation pass.
 *
 * @param sessionId - The session id to claim against.
 * @param runId - The expected current lease value (also written back).
 * @returns true on success, false on contention or error.
 */
export async function claimSessionLifecycleRunIdIfMatch(
  sessionId: string,
  runId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessions")
    .update({ lifecycle_run_id: runId })
    .eq("id", sessionId)
    .eq("lifecycle_run_id", runId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[claimSessionLifecycleRunIdIfMatch] error for ${sessionId}:`, error);
    return false;
  }
  return data !== null;
}
