import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import type { RollupAggregateRow } from "./aggregateRollupByAccount";

export interface RollupRow extends RollupAggregateRow {
  account_name: string | null;
  account_email: string | null;
}

/**
 * Joins `account_name` and `account_email` onto the page slice. Picks the
 * most-recently-updated email per account so multi-email accounts surface
 * a consistent address across requests (the `account_emails` table has no
 * `is_primary` column).
 *
 * @param page - The page slice from the rollup aggregation.
 * @returns Page rows with account name and email attached.
 */
export async function enrichRollupPageWithAccountDetails(
  page: RollupAggregateRow[],
): Promise<RollupRow[]> {
  if (page.length === 0) return [];

  const accountIds = page.map(r => r.account_id);
  const [accounts, emails] = await Promise.all([
    selectAccounts(accountIds),
    selectAccountEmails({ accountIds }),
  ]);

  const nameById = new Map(accounts.map(a => [a.id, a.name ?? null]));

  const emailByAccountId = new Map<string, string>();
  const sortedEmails = [...emails].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const row of sortedEmails) {
    if (!emailByAccountId.has(row.account_id)) {
      emailByAccountId.set(row.account_id, row.email);
    }
  }

  return page.map(r => ({
    ...r,
    account_name: nameById.get(r.account_id) ?? null,
    account_email: emailByAccountId.get(r.account_id) ?? null,
  }));
}
