import { computeExpiryDueAtMs } from "@/lib/sandbox/computeExpiryDueAtMs";
import { computeInactivityDueAtMs } from "@/lib/sandbox/computeInactivityDueAtMs";
import type { Tables } from "@/types/database.types";

/**
 * Computes when the lifecycle workflow should next wake up for a
 * session. Returns the earlier of the inactivity-due time and the
 * expiry-due time. Used by both the workflow (for
 * `sleep(new Date(wakeAtMs))`) and the stale-run detector in the
 * kick logic.
 *
 * @param row - The `sessions` row.
 * @returns Epoch ms when the next lifecycle action is due.
 */
export function getLifecycleDueAtMs(
  row: Pick<
    Tables<"sessions">,
    "hibernate_after" | "last_activity_at" | "sandbox_expires_at" | "updated_at"
  >,
): number {
  const inactivityDue = computeInactivityDueAtMs(row);
  const expiryDue = computeExpiryDueAtMs(row);
  if (expiryDue === null) return inactivityDue;
  return Math.min(inactivityDue, expiryDue);
}
