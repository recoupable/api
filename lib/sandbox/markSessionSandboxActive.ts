import { buildActiveLifecycleUpdate } from "@/lib/sandbox/buildActiveLifecycleUpdate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { Json, Tables } from "@/types/database.types";

/**
 * Write a freshly-connected sandbox's state back onto its session row and mark
 * it active — shared by `createSandboxHandler` (`POST /api/sandbox`) and the
 * headless `provisionRunSession` (`POST /api/chat/runs`) so both bind a
 * sandbox to a session identically (recoupable/chat#1813).
 *
 * Bumps `lifecycle_version`, derives the active lifecycle fields + expiry from
 * the state via `buildActiveLifecycleUpdate`, and clears any stale snapshot
 * pointer so a fresh provision doesn't surface an outdated snapshot.
 *
 * @param sessionRow - The session the sandbox is bound to.
 * @param sandboxState - The sandbox's `getState()` (runtime metadata + expiry).
 * @returns The updated session row, or null on DB error.
 */
export async function markSessionSandboxActive(
  sessionRow: Tables<"sessions">,
  sandboxState: Json,
): Promise<Tables<"sessions"> | null> {
  return updateSession(sessionRow.id, {
    sandbox_state: sandboxState,
    lifecycle_version: sessionRow.lifecycle_version + 1,
    ...buildActiveLifecycleUpdate(sandboxState),
    snapshot_url: null,
    snapshot_created_at: null,
  });
}
