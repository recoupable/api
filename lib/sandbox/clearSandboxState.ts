import { getPersistentSandboxName } from "@/lib/sandbox/getPersistentSandboxName";

/**
 * Strips runtime metadata (expiresAt, etc.) from a sandbox state while
 * preserving the durable resume handle (sandboxName) so a future
 * `connectSandbox` can pick it back up. Used by the lifecycle
 * workflow when transitioning to `hibernated`.
 *
 * @param state - The current `sandbox_state` JSON value.
 * @returns A trimmed state with only `type` + `sandboxName`, or null
 *   when the input is null.
 */
export function clearSandboxState(state: unknown): { type: string; sandboxName?: string } | null {
  if (!state || typeof state !== "object") return null;

  const sandboxName = getPersistentSandboxName(state);
  const type = (state as { type?: unknown }).type;

  return {
    type: typeof type === "string" ? type : "vercel",
    ...(sandboxName ? { sandboxName } : {}),
  };
}
