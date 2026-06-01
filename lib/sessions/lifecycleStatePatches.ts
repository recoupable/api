/**
 * Lifecycle fields applied synchronously when a session is archived via
 * `PATCH /api/sessions/{sessionId}`. Sandbox stop and snapshot clearing
 * run afterward via `stopSandboxOnArchive`.
 */
export const ARCHIVE_LIFECYCLE_PATCH = {
  lifecycle_state: "archived",
  lifecycle_error: null,
  lifecycle_run_id: null,
  sandbox_expires_at: null,
  hibernate_after: null,
} as const;

/**
 * Lifecycle fields applied synchronously when a session is unarchived via
 * `PATCH /api/sessions/{sessionId}`.
 */
export const UNARCHIVE_LIFECYCLE_PATCH = {
  lifecycle_state: null,
  lifecycle_error: null,
} as const;
