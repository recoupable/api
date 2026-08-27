import supabase from "@/lib/supabase/serverClient";
import { stripNullish } from "@/lib/objects/stripNullish";
import type { TablesInsert } from "@/types/database.types";

/**
 * Upserts an array of posts into the `posts` table, merging on
 * `post_url` so a re-scrape refreshes the engagement counts (and the
 * publish timestamp, which the handlers always set) in place — safe to
 * call repeatedly for the same post set during Apify webhook replays.
 * Null/undefined fields are dropped first, so a platform that omits a
 * count on one run never erases the count a previous run stored.
 *
 * @param posts - Rows matching the posts-table insert type.
 */
export async function upsertPosts(posts: TablesInsert<"posts">[]) {
  const cleaned = posts.map(stripNullish) as TablesInsert<"posts">[];
  const { data, error } = await supabase.from("posts").upsert(cleaned, { onConflict: "post_url" });

  if (error) {
    console.error("[ERROR] upsertPosts:", error);
    throw error;
  }

  return { data, error };
}
