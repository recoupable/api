import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";
import { getPostsByUrls } from "@/lib/supabase/posts/getPostsByUrls";

export type PostCommentWithRelations = Tables<"post_comments"> & {
  post?: Tables<"posts"> | null;
  social?: Tables<"socials"> | null;
};

/**
 * Selects `post_comments` rows with joined post + social rows. When
 * `postUrls` is provided, comments are filtered to those whose
 * underlying post URL matches one of the values.
 *
 * @param params.postUrls - Optional list of post URLs to restrict to.
 */
export async function selectPostComments({
  postUrls,
}: {
  postUrls?: string[];
} = {}): Promise<PostCommentWithRelations[]> {
  let query = supabase.from("post_comments").select(`
    *,
    post:posts(*),
    social:socials(*)
  `);

  if (postUrls && postUrls.length > 0) {
    const posts = await getPostsByUrls(postUrls);
    if (posts.length === 0) return [];
    query = query.in(
      "post_id",
      posts.map(p => p.id),
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectPostComments:", error);
    throw error;
  }

  return (data as PostCommentWithRelations[] | null) ?? [];
}
