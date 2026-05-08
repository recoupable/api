import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import type { Tables } from "@/types/database.types";

/**
 * Predicate for the kick logic: returns true when a session is in a
 * shape where starting a lifecycle workflow makes sense. Filters out
 * archived sessions, sessions without a runtime sandbox, non-vercel
 * sandbox types, and sessions that already have a lifecycle run in
 * flight.
 *
 * @param session - The `sessions` row, or null.
 * @returns true when a lifecycle run should be started.
 */
export function shouldStartLifecycle(
  session: Tables<"sessions"> | null,
): session is Tables<"sessions"> {
  if (!session) return false;
  if (session.status === "archived" || session.lifecycle_state === "archived") return false;
  if (!session.sandbox_state) return false;
  if (!hasRuntimeSandboxState(session.sandbox_state)) return false;
  if ((session.sandbox_state as { type?: unknown }).type !== "vercel") return false;
  if (session.lifecycle_run_id) return false;
  return true;
}
