import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type AccountArtistId = Tables<"account_artist_ids">;

/**
 * Inserts an account-artist relationship into the account_artist_ids table.
 * This associates an artist account with a user/owner account.
 *
 * @param accountId - The account ID of the user/owner
 * @param artistId - The account ID of the artist
 * @returns The inserted relationship record
 * @throws Error if the insert fails
 */
export async function insertAccountArtistId(
  accountId: string,
  artistId: string,
): Promise<AccountArtistId> {
  const { data, error } = await supabase
    .from("account_artist_ids")
    .insert({
      account_id: accountId,
      artist_id: artistId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert account-artist relationship: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to insert account-artist relationship: No data returned");
  }

  return data;
}
