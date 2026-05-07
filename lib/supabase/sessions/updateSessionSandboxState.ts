import supabase from "@/lib/supabase/serverClient";
import type { Json, Tables } from "@/types/database.types";

interface UpdateSessionSandboxStateInput {
  /** Owning session id. */
  id: string;
  /** Persistable sandbox state from `sandbox.getState()`, or null to clear. */
  sandboxState: Json | null;
  /** Sandbox expiry as ISO string, or null when not yet known. */
  sandboxExpiresAt: string | null;
  /** Bumped lifecycle version (optimistic concurrency token). */
  lifecycleVersion: number;
}

/**
 * Writes sandbox runtime metadata onto a `sessions` row. Called when a
 * sandbox has just been provisioned (or resumed) for a session — sets
 * `lifecycle_state="active"` and refreshes `last_activity_at`. Returns
 * the updated row, or null on Supabase error.
 */
export async function updateSessionSandboxState({
  id,
  sandboxState,
  sandboxExpiresAt,
  lifecycleVersion,
}: UpdateSessionSandboxStateInput): Promise<Tables<"sessions"> | null> {
  const { data, error } = await supabase
    .from("sessions")
    .update({
      sandbox_state: sandboxState,
      lifecycle_state: "active",
      lifecycle_version: lifecycleVersion,
      sandbox_expires_at: sandboxExpiresAt,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateSessionSandboxState] error:", error);
    return null;
  }

  return data;
}
