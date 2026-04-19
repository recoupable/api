import supabase from "../serverClient";

/**
 * Returns the list of `social_id`s associated with a given artist account.
 *
 * This is a focused helper used by the fans query composer to resolve an
 * artist account to the set of social IDs we need to filter `social_fans` on.
 *
 * Throws on DB error — callers (domain composers) let the error bubble so
 * handlers can own the 500 envelope shape.
 */
export async function selectAccountSocialIds(artistAccountId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("account_socials")
    .select("social_id")
    .eq("account_id", artistAccountId)
    .limit(10000);

  if (error) {
    console.error("Error selecting account social IDs:", error);
    throw error;
  }

  return (data ?? [])
    .map(row => row.social_id)
    .filter((id): id is string => typeof id === "string");
}
