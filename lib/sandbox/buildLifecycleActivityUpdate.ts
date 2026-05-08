import { SANDBOX_INACTIVITY_TIMEOUT_MS } from "@/lib/sandbox/sandboxLifecycleConfig";
import type { TablesUpdate } from "@/types/database.types";

/**
 * Builds the lifecycle-related fields to write when refreshing a
 * sandbox's "last activity" — used by `/api/sandbox/activity` and
 * by `buildActiveLifecycleUpdate`. Sets `last_activity_at` to now,
 * pushes `hibernate_after` out by SANDBOX_INACTIVITY_TIMEOUT_MS, and
 * clears any stale `lifecycle_error`. Defaults `lifecycle_state` to
 * `"active"` but accepts `"restoring"` for the snapshot-resume path.
 *
 * @param activityAt - Optional override for "now"; defaults to current time.
 * @param lifecycleState - Defaults to `"active"`.
 * @returns A partial Supabase update object.
 */
export function buildLifecycleActivityUpdate(
  activityAt: Date = new Date(),
  lifecycleState: "active" | "restoring" = "active",
): Pick<
  TablesUpdate<"sessions">,
  "lifecycle_state" | "lifecycle_error" | "last_activity_at" | "hibernate_after"
> {
  return {
    lifecycle_state: lifecycleState,
    lifecycle_error: null,
    last_activity_at: activityAt.toISOString(),
    hibernate_after: new Date(activityAt.getTime() + SANDBOX_INACTIVITY_TIMEOUT_MS).toISOString(),
  };
}
