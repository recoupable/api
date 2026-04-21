import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

/**
 * Returns the GitHub repo URL associated with the account's latest snapshot.
 *
 * @param accountId - The account to look up
 * @returns The GitHub repo URL, or null if none is set
 */
export async function getAccountGithubRepo(accountId: string): Promise<string | null> {
  const accountSnapshots = await selectAccountSnapshots(accountId);
  return accountSnapshots[0]?.github_repo ?? null;
}
