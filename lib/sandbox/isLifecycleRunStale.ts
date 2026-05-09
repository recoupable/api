import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { SANDBOX_LIFECYCLE_STALE_RUN_GRACE_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import type { Tables } from "@/types/database.types";

/**
 * True when a session's `lifecycle_run_id` lease is past the calculated
 * due time + grace window. Indicates the workflow that owned the lease
 * either crashed or never started — the kick can safely reclaim the
 * lease and start a fresh run.
 *
 * @param session - The `sessions` row.
 * @returns true when the lease is stale and should be reclaimed.
 */
export function isLifecycleRunStale(session: Tables<"sessions">): boolean {
  if (!session.lifecycle_run_id) return false;
  if (session.lifecycle_state !== "active") return false;
  const overdueMs = Date.now() - getLifecycleDueAtMs(session);
  return overdueMs > SANDBOX_LIFECYCLE_STALE_RUN_GRACE_MS;
}
