import type { TablesUpdate } from "@/types/database.types";

/**
 * Builds the lifecycle-related fields to write when the workflow
 * pauses a sandbox. Clears `sandbox_expires_at`, `hibernate_after`,
 * and the `lifecycle_run_id` lease so a future kick can claim it.
 * Note the caller is responsible for separately clearing
 * `sandbox_state` runtime metadata via `clearSandboxState`.
 *
 * @returns A partial Supabase update object.
 */
export function buildHibernatedLifecycleUpdate(): TablesUpdate<"sessions"> {
  return {
    lifecycle_state: "hibernated",
    sandbox_expires_at: null,
    hibernate_after: null,
    lifecycle_run_id: null,
    lifecycle_error: null,
  };
}
