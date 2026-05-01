import supabase from "../serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Upserts rows into `social_posts` to link posts with the social account
 * that produced them. Conflicts on `(post_id, social_id)` are merged so
 * repeated webhook deliveries do not create duplicates.
 *
 * @param socialPosts - Rows to upsert.
 */
export async function upsertSocialPosts(socialPosts: TablesInsert<"social_posts">[]) {
  const { data, error } = await supabase
    .from("social_posts")
    .upsert(socialPosts, { onConflict: "post_id,social_id" });

  if (error) {
    console.error("[ERROR] upsertSocialPosts:", error);
    throw error;
  }

  return { data, error };
}
