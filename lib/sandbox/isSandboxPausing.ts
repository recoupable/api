import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";

/**
 * Returns true when a sandbox is actively being paused — i.e. it has
 * live runtime state but has not yet reached a terminal lifecycle state
 * (`hibernated` or `archived`).
 *
 * Used by `PATCH /api/sessions/{sessionId}` to guard unarchive requests:
 * if the sandbox is still pausing the request returns 409 so the caller
 * can retry once the sandbox has settled.
 */
export function isSandboxPausing(row: {
  sandbox_state: unknown;
  lifecycle_state: string | null;
}): boolean {
  return (
    hasRuntimeSandboxState(row.sandbox_state) &&
    row.lifecycle_state !== "hibernated" &&
    row.lifecycle_state !== "archived"
  );
}
