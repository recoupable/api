import supabase from "../serverClient";

export interface AccountEmailRow {
  account_id: string;
  email: string | null;
}

/**
 * Retrieves email addresses for the given account IDs from the account_emails table.
 *
 * @param accountIds - Array of account IDs to fetch emails for
 * @returns Array of { account_id, email } rows (empty array on error or empty input)
 */
export async function selectAccountEmails(
  accountIds: string[],
): Promise<AccountEmailRow[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("account_emails")
    .select("account_id, email")
    .in("account_id", accountIds);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => ({
    account_id: row.account_id ?? "",
    email: row.email,
  }));
}
