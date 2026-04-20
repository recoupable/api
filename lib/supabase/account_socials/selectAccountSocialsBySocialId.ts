import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Selects account_socials rows linking the given social id to its owning account(s).
 *
 * A single social may be linked to multiple accounts; the caller decides how to
 * resolve access across the set.
 *
 * @param socialId - The social id
 * @returns The matching account_socials rows, or null on query error
 */
export async function selectAccountSocialsBySocialId(
  socialId: string,
): Promise<Tables<"account_socials">[] | null> {
  const { data, error } = await supabase
    .from("account_socials")
    .select("*")
    .eq("social_id", socialId);

  if (error) {
    console.error("[ERROR] selectAccountSocialsBySocialId:", error);
    return null;
  }

  return data || [];
}
