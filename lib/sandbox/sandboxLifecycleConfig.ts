/**
 * Lifecycle workflow tuning. All values copied from open-agents'
 * `lib/sandbox/config.ts` and intentionally kept in sync — these are
 * the timings the sandbox lifecycle FSM uses to decide when to wake
 * up, hibernate, and detect stale runs.
 */

/**
 * How long a sandbox can be idle before the lifecycle workflow pauses
 * it. 5 minutes — short enough to free compute aggressively, long
 * enough that a user briefly switching tabs doesn't lose their
 * session.
 */
export const SANDBOX_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Buffer subtracted from `sandbox_expires_at` when computing the
 * lifecycle wake time. Pause a few seconds before Vercel hard-stops
 * the sandbox so we have a chance to do graceful cleanup.
 */
export const SANDBOX_EXPIRES_BUFFER_MS = 10_000;

/**
 * Floor on the workflow's `sleep(date)` duration. Prevents tight loops
 * when the calculated wake time is in the past or extremely soon.
 */
export const SANDBOX_LIFECYCLE_MIN_SLEEP_MS = 5_000;

/**
 * How far past the calculated due time a session's `lifecycle_run_id`
 * may sit before the kick logic considers the run dead and reclaims
 * the lease. Prevents a crashed workflow from blocking future kicks
 * forever.
 */
export const SANDBOX_LIFECYCLE_STALE_RUN_GRACE_MS = 2 * 60 * 1000;
