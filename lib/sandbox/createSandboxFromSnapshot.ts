import type { Sandbox } from "@vercel/sandbox";
import { cloneGithubRepoInSandbox } from "@/lib/sandbox/cloneGithubRepoInSandbox";
import { createSandboxWithFallback } from "@/lib/sandbox/createSandboxWithFallback";
import { getAccountGithubRepo } from "@/lib/sandbox/getAccountGithubRepo";
import { getValidSnapshotId } from "@/lib/sandbox/getValidSnapshotId";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";

export interface CreateSandboxFromSnapshotResult {
  sandbox: Sandbox;
  fromSnapshot: boolean;
}

/**
 * Creates a new sandbox from the account's latest valid snapshot,
 * falling back to a fresh sandbox if the snapshot is expired or fails.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created Sandbox instance and whether it was created from a snapshot
 */
export async function createSandboxFromSnapshot(
  accountId: string,
): Promise<CreateSandboxFromSnapshotResult> {
  const [snapshotId, githubRepo] = await Promise.all([
    getValidSnapshotId(accountId),
    getAccountGithubRepo(accountId),
  ]);
  const { sandbox, fromSnapshot } = await createSandboxWithFallback(snapshotId);

  await insertAccountSandbox({
    account_id: accountId,
    sandbox_id: sandbox.sandboxId,
  });

  // Clone the account's GitHub repo into the sandbox if available
  try {
    await cloneGithubRepoInSandbox(sandbox, githubRepo);
  } catch (cloneError) {
    console.error("Failed to clone GitHub repo into sandbox:", cloneError);
  }

  return { sandbox, fromSnapshot };
}
