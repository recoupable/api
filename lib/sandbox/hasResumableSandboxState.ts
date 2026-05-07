import { getResumableSandboxName } from "@/lib/sandbox/getResumableSandboxName";

/**
 * True when the persisted state carries a durable resume handle —
 * either a persistent `sandboxName` or the legacy `sandboxId`.
 *
 * @param state - The persisted `sandbox_state` JSON value.
 * @returns true when the sandbox can be resumed.
 */
export function hasResumableSandboxState(state: unknown): boolean {
  return getResumableSandboxName(state) !== null;
}
