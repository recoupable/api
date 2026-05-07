import { refreshBaseSnapshot } from "@/lib/sandbox/abstraction";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import { DEFAULT_SANDBOX_BASE_SNAPSHOT_ID } from "@/lib/sandbox/defaultBaseSnapshotId";

const BUILD_SANDBOX_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const BUILD_COMMAND_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes — leaves buffer under sandbox timeout

interface BuildOrgSnapshotInput {
  cloneUrl: string;
  sandboxName: string;
}

async function buildSnapshotStep(input: BuildOrgSnapshotInput): Promise<string> {
  "use step";

  console.log(
    `[build-org-snapshot] step:start name='${input.sandboxName}' url='${input.cloneUrl}'`,
  );

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
    commands: [`git clone --depth=1 ${input.cloneUrl} .`],
    log: message => console.log(`[build-org-snapshot] ${message}`),
  });

  return result.snapshotId;
}

export async function buildOrgSnapshotWorkflow(input: BuildOrgSnapshotInput) {
  "use workflow";

  console.log(
    `[build-org-snapshot] workflow:start name='${input.sandboxName}' url='${input.cloneUrl}'`,
  );

  try {
    const snapshotId = await buildSnapshotStep(input);
    console.log(
      `[build-org-snapshot] Built ${snapshotId} for '${input.sandboxName}' (${input.cloneUrl})`,
    );
    return { success: true as const, snapshotId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[build-org-snapshot] Failed for '${input.sandboxName}' (${input.cloneUrl}):`,
      message,
    );
    return { success: false as const, error: message };
  }
}
