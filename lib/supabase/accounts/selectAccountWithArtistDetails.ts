import supabase from "../serverClient";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
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
  pinned?: boolean;
};

/**
 * Retrieves an account with artist-facing relations needed for artist responses.
 *
 * When requesterAccountId is provided, the returned row also carries the
 * requester's pinned state for that artist (from account_artist_ids) so the
 * formatted response reflects the caller's pin status.
 *
 * @param artistId - The artist account ID to fetch
 * @param requesterAccountId - Optional authenticated account ID used to attach pinned state
 * @returns The account with related info, socials, and optional pinned state, or null if not found
 */
export async function selectAccountWithArtistDetails(
  artistId: string,
  requesterAccountId?: string,
): Promise<AccountWithArtistDetails | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*, account_info(*), account_socials(*, social:socials(*))")
    .eq("id", artistId)
    .single();

  if (error || !data) {
    return null;
  }

  const account = data as AccountWithArtistDetails;

  if (requesterAccountId) {
    const pinRow = await selectAccountArtistId(requesterAccountId, artistId);
    account.pinned = pinRow?.pinned ?? false;
  }

  return account;
}
