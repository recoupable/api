import supabase from "../serverClient";

export interface AccountSnapshotOwner {
  account_id: string;
  github_repo: string;
}

/**
 * Selects all non-null github_repo URLs with their owning account_id from account_snapshots.
 * Used by admin endpoints to enumerate account repos for submodule analysis with owner info.
 *
 * @returns Array of { account_id, github_repo } objects
 */
export async function selectAllAccountSnapshotsWithOwners(): Promise<AccountSnapshotOwner[]> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .select("account_id, github_repo")
    .not("github_repo", "is", null)
    .not("account_id", "is", null);

  if (error) {
    console.error("Error fetching account snapshot owners:", error);
    return [];
  }

  return (data ?? []).filter(
    (row): row is AccountSnapshotOwner =>
      row.account_id !== null && row.github_repo !== null,
  );
}
