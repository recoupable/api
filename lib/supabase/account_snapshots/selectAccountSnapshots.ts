import supabase from "../serverClient";

interface AccountSnapshot {
  id: string;
  account_id: string;
  snapshot_id: string;
  created_at: string;
}

/**
 * Selects the most recent snapshot for an account.
 *
 * @param accountId - The account ID to get the snapshot for
 * @returns The snapshot record or null if not found
 */
export async function selectAccountSnapshot(accountId: string): Promise<AccountSnapshot | null> {
  const { data, error } = await supabase
    .from("account_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // Table might not exist or no snapshot found - both are ok
    return null;
  }

  return data;
}
