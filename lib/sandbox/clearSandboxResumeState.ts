/**
 * Strips *everything* from the persisted `sandbox_state` except the
 * `type` discriminator. Used when the sandbox is gone-gone (404 /
 * not-found) — even the durable resume handle is stale, so the next
 * provision must start from scratch.
 *
 * Sister helper to `clearSandboxState`, which preserves the resume
 * handle for cases where the sandbox can still be reconnected later.
 *
 * @param state - The current `sandbox_state` JSON value.
 * @returns A minimal state with only `type`, or null when the input is null.
 */
export function clearSandboxResumeState(state: unknown): { type: string } | null {
  if (!state || typeof state !== "object") return null;

  const type = (state as { type?: unknown }).type;
  return { type: typeof type === "string" ? type : "vercel" };
}
