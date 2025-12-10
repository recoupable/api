import supabase from "../serverClient";

/**
 * Retrieves an account with its related details (info, emails, wallets).
 *
 * @param accountId - The unique identifier of the account
 * @returns Flattened account object with all related data
 * @throws Error if account is not found
 */
export async function getAccountWithDetails(accountId: string) {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_emails(*), account_wallets(*)")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    return null;
  }

  // Flatten the nested relations into a single object
  return {
    ...account,
    ...(account.account_info?.[0] || {}),
    ...(account.account_emails?.[0] || {}),
    ...(account.account_wallets?.[0] || {}),
  };
}

