import { buildLifecycleActivityUpdate } from "@/lib/sandbox/buildLifecycleActivityUpdate";
import { getSandboxExpiresAtDate } from "@/lib/sandbox/getSandboxExpiresAtDate";
import type { TablesUpdate } from "@/types/database.types";

/**
 * Builds the lifecycle-related fields to write when transitioning a
 * session into the `active` state right after a sandbox has been
 * provisioned or resumed. Combines `buildLifecycleActivityUpdate`
 * with the sandbox's own `expiresAt` so the row's
 * `sandbox_expires_at` matches the freshly-probed runtime expiry.
 *
 * @param sandboxState - The `sandbox_state` JSON value, typically
 *   from `sandbox.getState()`.
 * @param options.activityAt - Optional override for "now".
 * @param options.lifecycleState - Defaults to `"active"`; pass
 *   `"restoring"` for the snapshot-resume path.
 * @returns A partial Supabase update object.
 */
export function buildActiveLifecycleUpdate(
  sandboxState: unknown,
  options?: { activityAt?: Date; lifecycleState?: "active" | "restoring" },
): TablesUpdate<"sessions"> {
  return {
    ...buildLifecycleActivityUpdate(options?.activityAt, options?.lifecycleState ?? "active"),
    sandbox_expires_at: getSandboxExpiresAtDate(sandboxState),
  };
}
