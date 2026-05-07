/**
 * Base snapshot used by `buildOrgSnapshotWorkflow` to bootstrap a fresh
 * sandbox before cloning an org repo into it. Lets the workflow skip
 * provisioning a bare image and start from one with the standard
 * Recoup tooling already installed, so the subsequent `git clone` is
 * the only meaningful work.
 *
 * Override at deploy time via `VERCEL_SANDBOX_BASE_SNAPSHOT_ID` to
 * roll forward to a newer base. The hardcoded fallback is the
 * snapshot that lives in the Recoup Vercel team.
 *
 * Current snapshot includes:
 *   - jq             (dnf install -y jq)
 *   - bun            (curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash)
 *   - agent-browser  (sudo npm install -g agent-browser)
 *   - code-server    (curl -fsSL https://code-server.dev/install.sh | sudo sh)
 *
 * To refresh: provision a clean sandbox with the @vercel/sandbox SDK,
 * run the install commands above (plus any new ones), snapshot it via
 * `vercel sandbox snapshot <id> --stop`, and update the constant
 * below with the new id.
 *
 * Tooling note: chromium is intentionally NOT in this base — Amazon
 * Linux 2023's default repo doesn't carry it, and `agent-browser`
 * fetches a managed Playwright browser on first use anyway.
 */
export const DEFAULT_SANDBOX_BASE_SNAPSHOT_ID =
  process.env.VERCEL_SANDBOX_BASE_SNAPSHOT_ID ?? "snap_RgVtpDO4y1BJHQiUbptMwS3Rt2EQ";
