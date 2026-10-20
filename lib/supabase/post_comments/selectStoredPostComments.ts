import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface Params {
  socialIds: string[];
  postId?: string;
  page: number;
  limit: number;
}

/** Scope through the post's linked creator socials, not the commenter's social ID. */
export async function selectStoredPostComments({
  socialIds,
  postId,
  page,
  limit,
}: Params): Promise<{
  comments: Tables<"post_comments">[];
  totalCount: number;
}> {
  if (socialIds.length === 0) return { comments: [], totalCount: 0 };
  let query = supabase
    .from("post_comments")
    .select(
      "id,post_id,social_id,comment,commented_at,posts!inner(social_posts!inner(social_id))",
      { count: "exact" },
    )
    .in("posts.social_posts.social_id", socialIds);
  if (postId) query = query.eq("post_id", postId);
  const from = (page - 1) * limit;
  const { data, error, count } = await query
    .order("commented_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  if (count === null) throw new Error("Stored comment count unavailable");
  return {
    comments: (data ?? []).map(({ id, post_id, social_id, comment, commented_at }) => ({
      id,
      post_id,
      social_id,
      comment,
      commented_at,
    })),
    totalCount: count,
  };
}
