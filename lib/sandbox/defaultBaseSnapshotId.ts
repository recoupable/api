/**
 * Base snapshot used by `buildOrgSnapshotWorkflow` to bootstrap a fresh
 * sandbox before cloning an org repo into it. Lets the workflow skip
 * provisioning a bare image and start from one with bun + jq +
 * agent-browser + chromium + code-server already installed, so the
 * subsequent `git clone` is the only meaningful work.
 *
 * Override at deploy time via `VERCEL_SANDBOX_BASE_SNAPSHOT_ID` to roll
 * forward to a newer base. The hardcoded fallback matches open-agents'
 * current value at the time of the port.
 */
export const DEFAULT_SANDBOX_BASE_SNAPSHOT_ID =
  process.env.VERCEL_SANDBOX_BASE_SNAPSHOT_ID ?? "snap_EjsphVxi07bFKrfojljJdIS41KHT";
