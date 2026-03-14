import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Inserts a new account_social record.
 *
 * @param accountId - The account ID
 * @param socialId - The social ID
 * @returns The inserted account_social record, or null if failed
 */
export async function insertAccountSocial(
  accountId: string,
  socialId: string,
): Promise<Tables<"account_socials"> | null> {
  const { data, error } = await supabase
    .from("account_socials")
    .insert({ account_id: accountId, social_id: socialId })
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] insertAccountSocial:", error);
    return null;
  }

  return data || null;
}
