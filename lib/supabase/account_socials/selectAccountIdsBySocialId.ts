import supabase from "../serverClient";

/**
 * Selects the account IDs that are linked to a given social.
 * Used to resolve the existing artist account behind a Spotify profile.
 *
 * @param socialId - The social ID to look up.
 * @returns The account IDs linked to the social (empty if none).
 * @throws Error if the query fails.
 */
export async function selectAccountIdsBySocialId(socialId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("account_socials")
    .select("account_id")
    .eq("social_id", socialId);

  if (error) {
    throw new Error(`Failed to fetch account IDs by social: ${error.message}`);
  }

  return (data ?? [])
    .map(row => row.account_id)
    .filter((id): id is string => typeof id === "string");
}
