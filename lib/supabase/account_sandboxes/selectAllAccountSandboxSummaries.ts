import supabase from "../serverClient";

export interface AccountSandboxSummary {
  account_id: string;
  account_name: string | null;
  total_sandboxes: number;
  last_created_at: string | null;
}

/**
 * Retrieves a summary of sandbox counts per account across all accounts.
 * Groups by account_id and joins with accounts table for the name.
 *
 * @returns Array of account sandbox summaries sorted by last_created_at descending
 */
export async function selectAllAccountSandboxSummaries(): Promise<AccountSandboxSummary[]> {
  // Get all sandbox records with account info
  const { data: sandboxes, error: sandboxError } = await supabase
    .from("account_sandboxes")
    .select("account_id, created_at")
    .order("created_at", { ascending: false });

  if (sandboxError || !sandboxes) {
    console.error("[ERROR] selectAllAccountSandboxSummaries:", sandboxError);
    return [];
  }

  // Aggregate by account_id
  const accountMap = new Map<
    string,
    { total: number; lastCreatedAt: string | null }
  >();

  for (const s of sandboxes) {
    const existing = accountMap.get(s.account_id);
    if (existing) {
      existing.total += 1;
    } else {
      accountMap.set(s.account_id, {
        total: 1,
        lastCreatedAt: s.created_at,
      });
    }
  }

  // Fetch account names
  const accountIds = [...accountMap.keys()];
  if (accountIds.length === 0) return [];

  const { data: accounts, error: accountError } = await supabase
    .from("accounts")
    .select("id, name")
    .in("id", accountIds);

  if (accountError) {
    console.error("[ERROR] selectAllAccountSandboxSummaries (accounts):", accountError);
  }

  const nameMap = new Map<string, string | null>();
  for (const a of accounts ?? []) {
    nameMap.set(a.id, a.name);
  }

  // Build result sorted by last_created_at descending
  const summaries: AccountSandboxSummary[] = accountIds.map(id => ({
    account_id: id,
    account_name: nameMap.get(id) ?? null,
    total_sandboxes: accountMap.get(id)!.total,
    last_created_at: accountMap.get(id)!.lastCreatedAt,
  }));

  summaries.sort((a, b) => {
    if (!a.last_created_at) return 1;
    if (!b.last_created_at) return -1;
    return b.last_created_at.localeCompare(a.last_created_at);
  });

  return summaries;
}
