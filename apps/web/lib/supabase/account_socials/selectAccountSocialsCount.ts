import supabase from "../serverClient";

/**
 * Selects the count of account_socials records for a given artist account.
 *
 * @param artist_account_id - The unique identifier of the artist account
 * @returns The count of account_socials records, or 0 if none found
 * @throws Error if the query fails
 */
export async function selectAccountSocialsCount(artist_account_id: string): Promise<number> {
  const { count, error } = await supabase
    .from("account_socials")
    .select("*", { count: "exact", head: true })
    .eq("account_id", artist_account_id);

  if (error) {
    throw new Error(`Failed to fetch account socials count: ${error.message}`);
  }

  return count ?? 0;
}
