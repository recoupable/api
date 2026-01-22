import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Raw account data with nested relations from Supabase join query.
 */
export type AccountWithRelations = Tables<"accounts"> & {
  account_info: Tables<"account_info">[] | null;
  account_emails: Tables<"account_emails">[] | null;
  account_wallets: Tables<"account_wallets">[] | null;
};

/**
 * Selects an account by wallet address.
 * Returns the account with related info, emails, and wallets.
 *
 * @param wallet - The wallet address to look up
 * @returns The account with relations if found, null otherwise
 * @throws Error if wallet not found or account lookup fails
 */
export async function selectAccountByWallet(wallet: string): Promise<AccountWithRelations> {
  const { data: walletFound, error: walletError } = await supabase
    .from("account_wallets")
    .select("*")
    .eq("wallet", wallet)
    .single();

  if (walletError || !walletFound) {
    throw new Error("No account found with this wallet address");
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_emails(*), account_wallets(*)")
    .eq("id", walletFound.account_id)
    .single();

  if (accountError || !account) {
    throw new Error("Error fetching account details");
  }

  return account as AccountWithRelations;
}
