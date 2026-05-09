import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";
import { SANDBOX_EXPIRES_BUFFER_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import type { Tables } from "@/types/database.types";

/**
 * Computes when a session's sandbox should hibernate due to expiry —
 * `sandbox_expires_at` minus a small buffer so we pause before
 * Vercel's hard timeout. Returns null when the row has no expiry set
 * (paused sandbox, type stub).
 *
 * @param row - The `sessions` row.
 * @returns Epoch ms of the expiry due time, or null when not applicable.
 */
export function computeExpiryDueAtMs(
  row: Pick<Tables<"sessions">, "sandbox_expires_at">,
): number | null {
  const expiresAt = isoToEpochMs(row.sandbox_expires_at);
  if (expiresAt === null) return null;
  return expiresAt - SANDBOX_EXPIRES_BUFFER_MS;
}
