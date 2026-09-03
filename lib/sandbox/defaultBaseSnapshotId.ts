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
 *   - ffmpeg/ffprobe (7.0.2 static build — see scripts/build-base-snapshot.ts)
 *
 * To refresh: `pnpm dlx tsx scripts/build-base-snapshot.ts` restores this
 * snapshot, layers the tooling on top, verifies every binary, snapshots with
 * no expiry and prints the new id; paste it below.
 *
 * Tooling note: ffmpeg comes from a static build, not dnf — Amazon Linux
 * 2023 carries no ffmpeg package. It is required by the music-video pipeline,
 * which muxes audio onto a render inside the sandbox (recoupable/app#2052).
 *
 * Tooling note: chromium is intentionally NOT in this base — Amazon
 * Linux 2023's default repo doesn't carry it, and `agent-browser`
 * fetches a managed Playwright browser on first use anyway.
 */
export const DEFAULT_SANDBOX_BASE_SNAPSHOT_ID =
  process.env.VERCEL_SANDBOX_BASE_SNAPSHOT_ID ?? "snap_tbpR2eFlVENexiRoMEcK5yl6WEbs";
