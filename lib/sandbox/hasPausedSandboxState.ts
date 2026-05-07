import { getResumableSandboxName } from "@/lib/sandbox/getResumableSandboxName";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";

/**
 * True when the state describes a sandbox that is paused but resumable
 * — has a durable name yet no live runtime metadata. Used by the UI to
 * decide whether to show "Resume" affordances.
 *
 * @param state - The persisted `sandbox_state` JSON value.
 * @returns true when the sandbox is paused-but-resumable.
 */
export function hasPausedSandboxState(state: unknown): boolean {
  return getResumableSandboxName(state) !== null && !hasRuntimeSandboxState(state);
}
