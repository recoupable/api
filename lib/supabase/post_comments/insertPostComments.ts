import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upserts rows into `post_comments`. Conflicts on
 * `(post_id, social_id, comment, commented_at)` are ignored so replays
 * of the same Apify dataset do not duplicate comments.
 *
 * @param comments - Rows to insert.
 */
export async function insertPostComments(
  comments: TablesInsert<"post_comments">[],
): Promise<Tables<"post_comments">[]> {
  if (comments.length === 0) return [];

  const { data, error } = await supabase
    .from("post_comments")
    .upsert(comments, {
      onConflict: "post_id,social_id,comment,commented_at",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    console.error("[ERROR] insertPostComments:", error);
    throw error;
  }

  return data ?? [];
}
