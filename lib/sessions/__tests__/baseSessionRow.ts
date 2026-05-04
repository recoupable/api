import type { Tables } from "@/types/database.types";

/**
 * Returns a fully-populated `sessions` row suitable for mocking
 * `insertSession` / `selectSession` in tests. Pass `overrides` to
 * customize fields per case.
 */
export function baseSessionRow(overrides: Partial<Tables<"sessions">> = {}): Tables<"sessions"> {
  return {
    id: "sess_1",
    account_id: "acc-uuid-1",
    title: "Test session",
    status: "running",
    repo_owner: null,
    repo_name: null,
    branch: null,
    clone_url: null,
    is_new_branch: false,
    global_skill_refs: [],
    sandbox_state: { type: "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
    last_activity_at: null,
    sandbox_expires_at: null,
    hibernate_after: null,
    lifecycle_run_id: null,
    lifecycle_error: null,
    lines_added: 0,
    lines_removed: 0,
    snapshot_url: null,
    snapshot_created_at: null,
    snapshot_size_bytes: null,
    cached_diff: null,
    cached_diff_updated_at: null,
    created_at: "2026-05-04T00:00:00.000Z",
    updated_at: "2026-05-04T00:00:00.000Z",
    ...overrides,
  };
}
