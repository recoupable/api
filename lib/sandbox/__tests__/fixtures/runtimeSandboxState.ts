/** Epoch ms used in tests for a live sandbox row (`sandbox_state.expiresAt`). */
export const RUNTIME_EXPIRES_AT = 4_102_444_800_000;

/** Minimal live runtime `sandbox_state` blob matching open-agents semantics. */
export function runtimeSandboxState(
  sandboxName = "session-sess-1",
  expiresAt = RUNTIME_EXPIRES_AT,
): { type: string; sandboxName: string; expiresAt: number } {
  return { type: "vercel", sandboxName, expiresAt };
}
