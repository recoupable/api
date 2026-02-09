import supabase from "../serverClient";

/**
 * Updates the github_repo field on an existing account_snapshots row.
 * If no row exists for the account, this is a no-op.
 *
 * @param accountId - The account ID
 * @param githubRepo - The GitHub repo URL to set
 */
export async function updateAccountSnapshotGithubRepo(
  accountId: string,
  githubRepo: string,
): Promise<void> {
  const { error } = await supabase
    .from("account_snapshots")
    .update({ github_repo: githubRepo })
    .eq("account_id", accountId);

  if (error) {
    console.error("Failed to update account snapshot github_repo:", error);
  }
}
