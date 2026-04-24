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

  const { data } = await supabase
    .from("socials")
    .select("*")
    .eq("profile_url", profileUrl)
    .neq("profile_url", "")
    .single();

  return data ?? null;
}
