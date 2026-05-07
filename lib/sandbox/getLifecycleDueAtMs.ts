import {
  SANDBOX_EXPIRES_BUFFER_MS,
  SANDBOX_INACTIVITY_TIMEOUT_MS,
} from "@/lib/sandbox/sandboxLifecycleConfig";
import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";
import type { Tables } from "@/types/database.types";

/**
 * Computes when the lifecycle workflow should next wake up for a
 * session. Returns the earlier of:
 *   - inactivity due — `last_activity_at` (or `updated_at`) +
 *     SANDBOX_INACTIVITY_TIMEOUT_MS, overridden by `hibernate_after`
 *     if set
 *   - expiry due — `sandbox_expires_at` minus
 *     SANDBOX_EXPIRES_BUFFER_MS, so we pause before Vercel hard-stops
 *
 * Output is epoch milliseconds. Used by both the workflow (for
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

function computeInactivityDueAtMs(
  row: Pick<Tables<"sessions">, "hibernate_after" | "last_activity_at" | "updated_at">,
): number {
  const hibernateAfter = isoToEpochMs(row.hibernate_after);
  if (hibernateAfter !== null) return hibernateAfter;
  const lastActivity = isoToEpochMs(row.last_activity_at);
  const fallback = lastActivity ?? isoToEpochMs(row.updated_at) ?? Date.now();
  return fallback + SANDBOX_INACTIVITY_TIMEOUT_MS;
}

function computeExpiryDueAtMs(row: Pick<Tables<"sessions">, "sandbox_expires_at">): number | null {
  const expiresAt = isoToEpochMs(row.sandbox_expires_at);
  if (expiresAt === null) return null;
  return expiresAt - SANDBOX_EXPIRES_BUFFER_MS;
}
