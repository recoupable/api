import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";

export interface AccountSandboxStats {
  account_id: string;
  total_sandboxes: number;
  last_created_at: string;
}

/**
 * Aggregates sandbox statistics across all accounts.
 * Returns one row per account with total sandbox count and the most recent
 * sandbox creation timestamp, ordered by last_created_at descending.
 *
 * @returns Array of per-account sandbox stats
 */
export async function aggregateAccountSandboxStats(): Promise<AccountSandboxStats[]> {
  const rows = await selectAccountSandboxes({});

  if (rows.length === 0) {
    return [];
  }

  // Group by account_id: count rows, track latest created_at (rows are ordered desc)
  const statsMap = new Map<string, AccountSandboxStats>();

  for (const row of rows) {
    const existing = statsMap.get(row.account_id);
    if (!existing) {
      statsMap.set(row.account_id, {
        account_id: row.account_id,
        total_sandboxes: 1,
        last_created_at: row.created_at,
      });
    } else {
      existing.total_sandboxes += 1;
    }
  }

  return Array.from(statsMap.values()).sort(
    (a, b) =>
      new Date(b.last_created_at).getTime() - new Date(a.last_created_at).getTime(),
  );
}
