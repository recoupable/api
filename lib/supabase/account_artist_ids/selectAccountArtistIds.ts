import supabase from "@/lib/supabase/serverClient";

/**
 * Project `artist_id` values for the given account_ids. Returns `[]` when
 * `account_ids` is empty to avoid the undefined `.in(..., [])` behavior.
 */
export async function selectAccountArtistIds(accountIds: string[]) {
  if (accountIds.length === 0) return [];

  const { data, error } = await supabase
    .from("account_artist_ids")
    .select("artist_id")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error fetching account_artist_ids:", error);
    return [];
  }

  return data ?? [];
}
