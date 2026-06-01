import type { Tables } from "@/types/database.types";

/**
 * Translates the snake_case Supabase row into the camelCase shape that
 * open-agents' frontend expects, preserving its existing field names
 * (e.g. `userId` for what is now `account_id`). This keeps the wire
 * format identical so the open-agents frontend can cut over to api
 * with zero frontend code changes.
 *
 * @param row - The Supabase sessions row.
 * @returns The camelCase session payload for HTTP responses.
 */
export function toSessionResponse(row: Tables<"sessions">) {
  return {
    id: row.id,
    userId: row.account_id,
    artistId: row.artist_id,
    title: row.title,
    status: row.status,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    branch: row.branch,
    cloneUrl: row.clone_url,
    isNewBranch: row.is_new_branch,
    globalSkillRefs: row.global_skill_refs,
    sandboxState: row.sandbox_state,
    lifecycleState: row.lifecycle_state,
    lifecycleVersion: row.lifecycle_version,
    lastActivityAt: row.last_activity_at,
    sandboxExpiresAt: row.sandbox_expires_at,
    hibernateAfter: row.hibernate_after,
    lifecycleRunId: row.lifecycle_run_id,
    lifecycleError: row.lifecycle_error,
    linesAdded: row.lines_added,
    linesRemoved: row.lines_removed,
    snapshotUrl: row.snapshot_url,
    snapshotCreatedAt: row.snapshot_created_at,
    snapshotSizeBytes: row.snapshot_size_bytes,
    cachedDiff: row.cached_diff,
    cachedDiffUpdatedAt: row.cached_diff_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
