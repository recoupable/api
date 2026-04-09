import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type AccountSocialWithSocial = Tables<"account_socials"> & {
  social: Tables<"socials"> | null;
};

export type AccountWithArtistDetails = Tables<"accounts"> & {
  account_info: Tables<"account_info">[];
  account_socials: AccountSocialWithSocial[];
};

/**
 * Retrieves an account with artist-compatible relations for detail responses.
 *
 * @param accountId - The account ID to fetch
 * @returns Account row with account_info and joined socials, or null when missing
 */
export async function selectAccountWithArtistDetails(
  accountId: string,
): Promise<AccountWithArtistDetails | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_socials(*, social:socials(*))")
    .eq("id", accountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AccountWithArtistDetails;
}
