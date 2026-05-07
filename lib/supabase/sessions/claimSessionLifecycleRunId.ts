import supabase from "@/lib/supabase/serverClient";

/**
 * Atomically claims the `lifecycle_run_id` lease for a session. The
 * UPDATE only succeeds when the row's current value matches what the
 * caller passed as `expected` (typically null when claiming a fresh
 * lease, or the same `runId` when re-confirming during a workflow
 * step). This is the concurrency guard that prevents two kicks from
 * starting duplicate lifecycle workflows for the same session.
 *
 * Returns true when the lease was successfully claimed (the UPDATE
 * affected exactly one row), false otherwise.
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
  const query = supabase.from("sessions").update({ lifecycle_run_id: runId }).eq("id", sessionId);

  const filtered =
    expected === null ? query.is("lifecycle_run_id", null) : query.eq("lifecycle_run_id", expected);

  const { data, error } = await filtered.select("id").maybeSingle();

  if (error) {
    console.error(`[claimSessionLifecycleRunId] error for session ${sessionId}:`, error);
    return false;
  }

  return data !== null;
}
