import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Fetches `posts` rows matching any of the given URLs. Returns an
 * empty array for empty / invalid input.
 *
 * @param postUrls - Array of `post_url` values to look up.
 */
export async function getPostsByUrls(postUrls: string[]): Promise<Tables<"posts">[]> {
  if (!Array.isArray(postUrls) || postUrls.length === 0) return [];

  const { data, error } = await supabase.from("posts").select("*").in("post_url", postUrls);

  if (error) {
    console.error("[ERROR] getPostsByUrls:", error);
    return [];
  }

  return data ?? [];
}
