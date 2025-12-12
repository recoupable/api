import supabase from "../serverClient";

/**
 * Flattened account object with related details merged in.
 * Only the first row from each related table is included.
 */
export interface AccountWithDetails {
  id: string;
  created_at: string;
  // Fields from account_info (first row only)
  name?: string;
  image?: string;
  // Fields from account_emails (first row only)
  email?: string;
  // Fields from account_wallets (first row only)
  address?: string;
  // Allow additional fields from the base account or relations
  [key: string]: unknown;
}

/**
 * Retrieves an account with its related details (info, emails, wallets).
 *
 * Note: Only the first row from each related table (account_info, account_emails,
 * account_wallets) is used. If an account has multiple emails or wallets, only
 * the first one returned by Supabase will be included in the flattened result.
 *
 * @param accountId - The account's ID (UUID)
 * @returns Flattened account object with related data, or null if not found/error
 */
export async function getAccountWithDetails(
  accountId: string,
): Promise<AccountWithDetails | null> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_emails(*), account_wallets(*)")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return null;
  }

  // Flatten the nested relations into a single object.
  // Uses only the first row from each related table.
  return {
    ...account,
    ...(account.account_info?.[0] || {}),
    ...(account.account_emails?.[0] || {}),
    ...(account.account_wallets?.[0] || {}),
  };
}

