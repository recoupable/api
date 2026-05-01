import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Inserts a new account_wallets record linking a wallet to an account.
 *
 * @param accountId - The account ID to link the wallet to
 * @param wallet - The wallet address to insert
 * @returns The inserted account_wallets record
 * @throws Error if insert fails
 */
export async function insertAccountWallet(
  accountId: string,
  wallet: string,
): Promise<Tables<"account_wallets">> {
  const { data, error } = await supabase
    .from("account_wallets")
    .insert({
      account_id: accountId,
      wallet,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Error inserting wallet: ${error.message}`);
  }

  if (!data) {
    throw new Error("Error inserting wallet: No data returned");
  }

  return data;
}
