import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";
import type { Tables } from "@/types/database.types";

/**
 * Projects the lifecycle-relevant columns of a `sessions` row into the
 * docs-spec lifecycle envelope used by GET /api/sandbox/status.
 *
 * @param row - The `sessions` row.
 * @returns The lifecycle envelope: serverTime, state, and three epoch-ms timestamps.
 */
export function buildLifecycle(row: Tables<"sessions">) {
  return {
    serverTime: Date.now(),
    state: row.lifecycle_state,
    lastActivityAt: isoToEpochMs(row.last_activity_at),
    hibernateAfter: isoToEpochMs(row.hibernate_after),
    sandboxExpiresAt: isoToEpochMs(row.sandbox_expires_at),
  };
}
