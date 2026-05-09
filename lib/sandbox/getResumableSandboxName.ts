import { getPersistentSandboxName } from "@/lib/sandbox/getPersistentSandboxName";

/**
 * Returns the durable name used to resume a paused sandbox. Falls back
 * to a legacy `sandboxId` field for sessions written before the
 * persistent-name migration in open-agents.
 *
 * @param state - The persisted `sandbox_state` JSON value.
 * @returns A name suitable for `connectSandbox` resume, or null.
 */
export function getResumableSandboxName(state: unknown): string | null {
  const persistent = getPersistentSandboxName(state);
  if (persistent) return persistent;

  if (!state || typeof state !== "object") return null;
  const candidate = state as { sandboxId?: unknown };
  return typeof candidate.sandboxId === "string" && candidate.sandboxId.length > 0
    ? candidate.sandboxId
    : null;
}
