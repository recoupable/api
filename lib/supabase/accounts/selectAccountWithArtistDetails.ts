import supabase from "../serverClient";
import type { Database } from "@/types/database.types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInfoRow = Database["public"]["Tables"]["account_info"]["Row"];
type AccountSocialRow = Database["public"]["Tables"]["account_socials"]["Row"];
type SocialRow = Database["public"]["Tables"]["socials"]["Row"];

export type AccountWithArtistDetails = AccountRow & {
  account_info: AccountInfoRow[];
  account_socials: Array<
    AccountSocialRow & {
      social: SocialRow | null;
    }
  >;
};

/**
 * Retrieves an account with artist-facing relations needed for artist responses.
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
