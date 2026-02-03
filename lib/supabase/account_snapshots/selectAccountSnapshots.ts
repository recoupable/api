import supabase from "../serverClient";

interface AccountSnapshot {
  id: string;
  account_id: string;
  snapshot_id: string;
  created_at: string;
}

/**
 * Selects snapshots for an account, ordered by creation date (newest first).
 *
 * @param accountId - The account ID to get snapshots for
 * @returns Array of snapshot records, or empty array if none found
 */
export async function selectAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not exist or query failed - return empty array
    return [];
  }

  return data ?? [];
}
