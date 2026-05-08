import { clearSandboxResumeState } from "@/lib/sandbox/clearSandboxResumeState";
import { clearSandboxState } from "@/lib/sandbox/clearSandboxState";
import { isSandboxNotFoundError } from "@/lib/sandbox/isSandboxNotFoundError";

/**
 * Decides how aggressively to wipe the persisted `sandbox_state`
 * based on the error that surfaced from the runtime:
 *   - 404 / not-found → drop the resume handle too (sandbox is gone)
 *   - generic unavailability → preserve the resume handle (could
 *     still be reconnected via `connectSandbox` later)
 *
 * @param state - The current `sandbox_state` JSON value.
 * @param message - The error message that triggered the cleanup.
 * @returns A trimmed state, or null when the input is null.
 */
export function clearUnavailableSandboxState(
  state: unknown,
  message: string,
): { type: string; sandboxName?: string } | null {
  return isSandboxNotFoundError(message)
    ? clearSandboxResumeState(state)
    : clearSandboxState(state);
}
