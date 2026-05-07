import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";

/**
 * True when the sandbox state has live runtime metadata that supports
 * operations like stop/extend/exec. Different from `isSandboxActive`
 * which also requires a non-expired `expiresAt` — this returns true
 * even shortly after expiry, while the runtime is still potentially
 * reachable. Used by the lifecycle workflow when deciding whether the
 * sandbox is something it can act on at all.
 *
 * @param state - The persisted `sandbox_state` JSON value.
 * @returns true when the state has runtime fields.
 */
export function canOperateOnSandbox(state: unknown): boolean {
  return hasRuntimeSandboxState(state);
}
