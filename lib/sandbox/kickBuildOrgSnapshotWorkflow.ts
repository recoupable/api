import { start } from "workflow/api";
import { buildOrgSnapshotWorkflow } from "@/app/workflows/buildOrgSnapshotWorkflow";

interface KickBuildOrgSnapshotInput {
  cloneUrl: string;
  sandboxName: string;
}

/**
 * Fire-and-forget kick of `buildOrgSnapshotWorkflow`. Used by
 * `createSandboxHandler` when a recoupable org repo is requested but
 * no `created` snapshot exists yet — the next session for the same
 * org will warm-boot from the snapshot this build produces.
 *
 * Failures are logged but never surfaced. The current request always
 * falls back to the slow full-clone path; what we're protecting is
 * that *future* requests don't have to.
 *
 * Logging omits `cloneUrl` to avoid surfacing any embedded credential
 * (e.g. `https://user:token@github.com/...`) — the `sandboxName` is
 * already the regex-extracted repo name only, which uniquely
 * identifies the org for observability without exposing tokens.
 *
 * @param input - The repo URL to clone and the sandbox name to use
 *   (which becomes the snapshot's name and the lookup key for
 *   `findOrgSnapshot`).
 */
export function kickBuildOrgSnapshotWorkflow(input: KickBuildOrgSnapshotInput) {
  void start(buildOrgSnapshotWorkflow, [input]).then(
    run =>
      console.log(
        `[build-org-snapshot] Started workflow run ${run.runId} for '${input.sandboxName}'`,
      ),
    error =>
      console.error(
        `[build-org-snapshot] Failed to start workflow for '${input.sandboxName}':`,
        error,
      ),
  );
}
