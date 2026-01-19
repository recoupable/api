import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Account with account_socials and account_info relations.
 * Includes created_at and updated_at for compatibility with artist creation flow.
 */
export type AccountWithSocials = Tables<"accounts"> & {
  account_socials: Tables<"account_socials">[];
  account_info: Tables<"account_info">[];
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Retrieves an account with its related socials and info.
 *
 * @param accountId - The account's ID (UUID)
 * @returns Account with socials and info arrays, or null if not found/error
 */
export async function selectAccountWithSocials(
  accountId: string,
): Promise<AccountWithSocials | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*, account_socials(*), account_info(*)")
    .eq("id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  // Add created_at and updated_at for compatibility
  // updated_at comes from account_info, created_at derived from timestamp
  const accountInfo = data.account_info?.[0];
  return {
    ...data,
    created_at: data.timestamp ? new Date(data.timestamp).toISOString() : null,
    updated_at: accountInfo?.updated_at ?? null,
  } as AccountWithSocials;
}
