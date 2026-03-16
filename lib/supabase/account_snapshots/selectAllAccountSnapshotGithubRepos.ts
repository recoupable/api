import supabase from "../serverClient";

/**
 * Selects all non-null github_repo URLs from account_snapshots.
 * Used by admin endpoints to enumerate account repos for submodule analysis.
 *
 * @returns Array of github_repo URL strings
 */
export async function selectAllAccountSnapshotGithubRepos(): Promise<string[]> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .select("github_repo")
    .not("github_repo", "is", null);

  if (error) {
    console.error("Error fetching account snapshot github repos:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => row.github_repo)
    .filter((url): url is string => url !== null);
}
