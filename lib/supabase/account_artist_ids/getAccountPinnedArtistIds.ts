import supabase from "../serverClient";

/**
 * Get all artist IDs that an account has pinned.
 *
 * @param accountId - The account's ID
 * @returns Set of artist IDs the account has pinned
 */
export async function getAccountPinnedArtistIds(accountId: string): Promise<Set<string>> {
  if (!accountId) return new Set();

  const { data, error } = await supabase
    .from("account_artist_ids")
    .select("artist_id")
    .eq("account_id", accountId)
    .eq("pinned", true);

  if (error || !data) return new Set();

  return new Set(data.map(row => row.artist_id));
}
