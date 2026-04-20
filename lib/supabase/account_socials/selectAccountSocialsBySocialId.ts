import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select account_socials rows linking accounts to a given social_id.
 *
 * Throws on database error so callers fail closed (e.g. access-control
 * checks cannot be silently bypassed by treating errors as "no links").
 * Returns an empty array when no rows match.
 */
export async function selectAccountSocialsBySocialId(
  socialId: string,
): Promise<Tables<"account_socials">[]> {
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
