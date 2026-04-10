import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Deletes a direct account-artist relationship.
 *
 * @param accountId - The requester account ID
 * @param artistId - The artist account ID
 * @returns Deleted account_artist_ids rows
 */
export async function deleteAccountArtistId(
  accountId: string,
  artistId: string,
): Promise<Tables<"account_artist_ids">[]> {
  const { data, error } = await supabase
    .from("account_artist_ids")
    .delete()
    .eq("account_id", accountId)
    .eq("artist_id", artistId)
    .select("*");

  if (error) {
    throw new Error(`Failed to delete account-artist relationship: ${error.message}`);
  }

  return data || [];
}
