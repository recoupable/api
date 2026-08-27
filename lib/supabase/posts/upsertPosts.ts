import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Upserts an array of posts into the `posts` table, merging on
 * `post_url` so a re-scrape refreshes the engagement counts (and the
 * publish timestamp, which the handlers always set) in place — safe to
 * call repeatedly for the same post set during Apify webhook replays.
 *
 * @param posts - Rows matching the posts-table insert type.
 */
export async function upsertPosts(posts: TablesInsert<"posts">[]) {
  const { data, error } = await supabase.from("posts").upsert(posts, { onConflict: "post_url" });

  if (error) {
    console.error("[ERROR] upsertPosts:", error);
    throw error;
  }

  return { data, error };
}
