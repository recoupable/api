import type { Sandbox } from "@vercel/sandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { updateAccountSnapshotGithubRepo } from "@/lib/supabase/account_snapshots/updateAccountSnapshotGithubRepo";
import { createGithubRepo } from "./createGithubRepo";
import { cloneRepoIntoSandbox } from "./cloneRepoIntoSandbox";

/**
 * Ensures a GitHub repository exists for the account, is persisted in
 * account_snapshots, and is cloned into the sandbox.
 *
 * @param accountId - The account ID
 * @param sandbox - The live Vercel Sandbox instance
 * @returns The GitHub repo URL, or undefined if setup failed
 */
export async function ensureGithubRepo(
  accountId: string,
  sandbox: Sandbox,
): Promise<string | undefined> {
  // Check if account already has a github_repo
  const snapshots = await selectAccountSnapshots(accountId);
  const existingRepo = snapshots[0]?.github_repo;

  if (existingRepo) {
    await cloneRepoIntoSandbox(sandbox, existingRepo);
    return existingRepo;
  }

  // No repo yet - get account name and create one
  const accounts = await selectAccounts(accountId);
  const account = accounts[0];

  if (!account) {
    console.error("Account not found for repo creation", { accountId });
    return undefined;
  }

  const repoUrl = await createGithubRepo(account.name, accountId);

  if (!repoUrl) {
    return undefined;
  }

  // Persist the repo URL in account_snapshots (updates existing row if present)
  await updateAccountSnapshotGithubRepo(accountId, repoUrl);

  // Clone into sandbox
  await cloneRepoIntoSandbox(sandbox, repoUrl);

  return repoUrl;
}
