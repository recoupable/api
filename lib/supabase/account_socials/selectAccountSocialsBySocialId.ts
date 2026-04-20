import supabase from "../serverClient";

/**
 * Selects account_socials rows linking accounts to a given social_id.
 *
 * Throws on database error so callers fail closed (e.g. access-control
 * checks cannot be silently bypassed by treating errors as "no links").
 * Returns an empty array when no rows match.
 *
 * @param socialId - The social ID to look up.
 * @returns The account_socials rows linking accounts to the given social_id.
 * @throws Error if the query fails.
 */
export async function selectAccountSocialsBySocialId(socialId: string) {
  const { data, error } = await supabase
    .from("account_socials")
    .select("*")
    .eq("social_id", socialId);

  if (error) {
    console.error("[ERROR] selectAccountSocialsBySocialId:", error);
    throw new Error(`Failed to fetch account_socials for social_id=${socialId}: ${error.message}`);
  }

  return data ?? [];
}
