import supabase from "@/lib/supabase/serverClient";

/**
 * Project `artist_id` values from account_artist_ids, filtered by the
 * accounts that hold the artists and/or by the artists themselves. Returns
 * `[]` when a given id list is empty to avoid the undefined `.in(..., [])`
 * behavior.
 *
 * @param filters.accountIds - Accounts whose artists to select.
 * @param filters.artistIds - Artists whose rows to select.
 * @returns Rows with artist_id, or null on error.
 */
export async function selectAccountArtistIds(filters: {
  accountIds?: string[];
  artistIds?: string[];
}) {
  const { accountIds, artistIds } = filters;
  if (accountIds?.length === 0 || artistIds?.length === 0) return [];

  let query = supabase.from("account_artist_ids").select("artist_id");
  if (accountIds) query = query.in("account_id", accountIds);
  if (artistIds) query = query.in("artist_id", artistIds);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching account_artist_ids:", error);
    return null;
  }

  return data ?? [];
}
