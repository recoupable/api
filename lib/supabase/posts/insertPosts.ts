import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Upserts an array of posts into the `posts` table. Duplicates on
 * `post_url` are ignored so this is safe to call repeatedly for the
 * same post set during Apify webhook replays.
 *
 * @param posts - Rows matching the posts-table insert type.
 */
export async function insertPosts(posts: TablesInsert<"posts">[]) {
  const { data, error } = await supabase
    .from("posts")
    .upsert(posts, { onConflict: "post_url", ignoreDuplicates: true });

  if (error) {
    console.error("[ERROR] insertPosts:", error);
    throw error;
  }

  return { data, error };
}
