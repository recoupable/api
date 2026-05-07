import supabase from "@/lib/supabase/serverClient";

/**
 * Atomic Supabase write: claims `lifecycle_run_id` for a session only
 * if the row's current value is NULL. Returns true on successful
 * claim, false if the row was already taken. Used for INITIAL claims
 * (i.e. starting a fresh lifecycle run from a kick).
 *
 * @param sessionId - The session id to claim against.
 * @param runId - The new lease value to write.
 * @returns true on success, false on contention or error.
 */
export async function claimSessionLifecycleRunIdIfNull(
  sessionId: string,
  runId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessions")
    .update({ lifecycle_run_id: runId })
    .eq("id", sessionId)
    .is("lifecycle_run_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[claimSessionLifecycleRunIdIfNull] error for ${sessionId}:`, error);
    return false;
  }
  return data !== null;
}
