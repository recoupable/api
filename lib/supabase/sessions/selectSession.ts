import supabase from "@/lib/supabase/serverClient";

/**
 * Row shape for the `sessions` table (added in database PR #20 — open-agents
 * Phase 0 schema port). Hand-typed here pending types/database.types.ts
 * regeneration; remove once `Tables<"sessions">` is available there.
 */
export interface SessionRow {
  id: string;
  account_id: string;
  title: string;
  status: "running" | "completed" | "failed" | "archived";
  repo_owner: string | null;
  repo_name: string | null;
  branch: string | null;
  clone_url: string | null;
  is_new_branch: boolean;
  global_skill_refs: unknown;
  sandbox_state: unknown | null;
  lifecycle_state:
    | "provisioning"
    | "active"
    | "hibernating"
    | "hibernated"
    | "restoring"
    | "archived"
    | "failed"
    | null;
  lifecycle_version: number;
  last_activity_at: string | null;
  sandbox_expires_at: string | null;
  hibernate_after: string | null;
  lifecycle_run_id: string | null;
  lifecycle_error: string | null;
  lines_added: number | null;
  lines_removed: number | null;
  snapshot_url: string | null;
  snapshot_created_at: string | null;
  snapshot_size_bytes: number | null;
  cached_diff: unknown | null;
  cached_diff_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Select a single session row by its id, or null if not found.
 * Caller is responsible for any ownership / access-control checks.
 */
export async function selectSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error(`[selectSession] error for sessionId=${sessionId}:`, error);
    return null;
  }

  return (data as SessionRow | null) ?? null;
}
