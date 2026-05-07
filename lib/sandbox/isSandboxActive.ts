import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { isoToEpochMs } from "@/lib/sandbox/isoToEpochMs";
import type { Tables } from "@/types/database.types";

const SANDBOX_EXPIRES_BUFFER_MS = 10_000;

/**
 * Decides whether the sandbox bound to a session row should be reported
 * as `"active"` by GET /api/sandbox/status. Active iff the row carries
 * real runtime metadata (not the type-only stub from session creation)
 * AND the recorded expiry is at least 10s in the future.
 *
 * @param row - The `sessions` row.
 * @returns true when the sandbox is alive and unexpired.
 */
export function isSandboxActive(row: Tables<"sessions">): boolean {
  if (!hasRuntimeSandboxState(row.sandbox_state)) return false;
  const expiresAt = isoToEpochMs(row.sandbox_expires_at);
  if (expiresAt === null) return true;
  return Date.now() < expiresAt - SANDBOX_EXPIRES_BUFFER_MS;
}
