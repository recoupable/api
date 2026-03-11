import supabase from "../serverClient";

export interface AccountSandboxStats {
  account_id: string;
  total_sandboxes: number;
  last_created_at: string;
}

/**
 * Aggregates sandbox statistics across all accounts.
 * Returns one row per account with total sandbox count and the most recent
 * sandbox creation timestamp.
 *
 * Intended for admin-only use.
 *
 * @returns Array of per-account sandbox stats ordered by last_created_at desc
 */
export async function selectAllAccountSandboxStats(): Promise<AccountSandboxStats[]> {
  const { data, error } = await supabase
    .from("account_sandboxes")
    .select("account_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching account sandbox stats:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate in-process: group by account_id, count rows, track latest created_at
  const statsMap = new Map<string, AccountSandboxStats>();

  for (const row of data) {
    const existing = statsMap.get(row.account_id);
    if (!existing) {
      statsMap.set(row.account_id, {
        account_id: row.account_id,
        total_sandboxes: 1,
        // data is ordered desc so first occurrence is latest
        last_created_at: row.created_at,
      });
    } else {
      existing.total_sandboxes += 1;
    }
  }

  // Sort by last_created_at descending
  return Array.from(statsMap.values()).sort(
    (a, b) => new Date(b.last_created_at).getTime() - new Date(a.last_created_at).getTime(),
  );
}
