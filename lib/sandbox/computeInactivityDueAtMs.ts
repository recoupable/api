import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";
import { SANDBOX_INACTIVITY_TIMEOUT_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import type { Tables } from "@/types/database.types";

/**
 * Computes when a session's sandbox should hibernate due to inactivity.
 * Prefers `hibernate_after` if set; otherwise computes from the most
 * recent activity timestamp + SANDBOX_INACTIVITY_TIMEOUT_MS.
 *
 * @param row - The `sessions` row.
 * @returns Epoch ms of the inactivity due time.
 */
export function computeInactivityDueAtMs(
  row: Pick<Tables<"sessions">, "hibernate_after" | "last_activity_at" | "updated_at">,
): number {
  const hibernateAfter = isoToEpochMs(row.hibernate_after);
  if (hibernateAfter !== null) return hibernateAfter;
  const lastActivity = isoToEpochMs(row.last_activity_at);
  const fallback = lastActivity ?? isoToEpochMs(row.updated_at) ?? Date.now();
  return fallback + SANDBOX_INACTIVITY_TIMEOUT_MS;
}
