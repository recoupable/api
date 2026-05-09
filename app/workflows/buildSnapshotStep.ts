import { refreshBaseSnapshot } from "@/lib/sandbox/abstraction";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import { DEFAULT_SANDBOX_BASE_SNAPSHOT_ID } from "@/lib/sandbox/defaultBaseSnapshotId";
import { shellEscape } from "@/lib/sandbox/shellEscape";

const BUILD_SANDBOX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const BUILD_COMMAND_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes — leaves buffer under sandbox timeout

export interface BuildOrgSnapshotInput {
  cloneUrl: string;
  sandboxName: string;
}

/**
 * Single step of `buildOrgSnapshotWorkflow`. Provisions a sandbox from
 * the recoup base snapshot, runs `git clone --depth=1 <cloneUrl> .`
 * inside it, and snapshots the result. Returns the new snapshot id.
 *
 * The cloneUrl is shell-escaped before interpolation: the validator
 * upstream of this workflow already rejects anything that doesn't
 * match `^https:\/\/github\.com\/recoupable\/...`, but defense-in-depth
 * — never trust the validator to also be a shell-quoter.
 *
 * Logging deliberately omits `cloneUrl` to avoid surfacing any token
 * embedded as `https://user:token@github.com/...`. The `sandboxName`
 * is the regex-extracted repo name only, so it's safe to log.
 */
export async function buildSnapshotStep(input: BuildOrgSnapshotInput): Promise<string> {
  "use step";

  console.log(`[build-org-snapshot] step:start name='${input.sandboxName}'`);

  const githubToken = getServiceGithubToken() ?? undefined;
  if (!githubToken) {
    throw new Error("[build-org-snapshot] GITHUB_TOKEN is not set; cannot clone org repo");
  }

  const result = await refreshBaseSnapshot({
    baseSnapshotId: DEFAULT_SANDBOX_BASE_SNAPSHOT_ID,
    sandboxName: input.sandboxName,
    sandboxTimeoutMs: BUILD_SANDBOX_TIMEOUT_MS,
    commandTimeoutMs: BUILD_COMMAND_TIMEOUT_MS,
    githubToken,
    commands: [`git clone --depth=1 ${shellEscape(input.cloneUrl)} .`],
    log: message => console.log(`[build-org-snapshot] ${message}`),
  });

  return result.snapshotId;
}
