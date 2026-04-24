import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Fetches a single `socials` row by normalized `profile_url`.
 * Returns `null` when no row matches or the URL is empty.
 *
 * @param profileUrl - Normalized profile URL.
 */
export async function selectSocialByProfileUrl(
  profileUrl: string,
): Promise<Tables<"socials"> | null> {
  if (!profileUrl) return null;

  const { data, error } = await supabase
    .from("socials")
    .select("*")
    .eq("profile_url", profileUrl)
    .neq("profile_url", "")
    .maybeSingle();

  if (error) {
    console.error("[ERROR] selectSocialByProfileUrl:", error);
    throw error;
  }

  return data ?? null;
}
