import { isSandboxPausing } from "@/lib/sandbox/isSandboxPausing";

/**
 * Returns true when an unarchive request should be rejected with 409:
 * the sandbox has no snapshot to restore from and is still actively pausing.
 *
 * Without a snapshot, the sandbox cannot be unarchived until the pause
 * completes; callers should retry after the sandbox settles.
 */
export function isUnarchiveConflict(row: {
  sandbox_state: unknown;
  lifecycle_state: string | null;
  snapshot_url: string | null;
}): boolean {
  return !row.snapshot_url && isSandboxPausing(row);
}
