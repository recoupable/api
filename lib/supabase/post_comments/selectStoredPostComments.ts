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
  const scopedQuery = (head = false) => {
    let query = supabase
      .from("post_comments")
      .select(
        "id,post_id,social_id,comment,commented_at,posts!inner(social_posts!inner(social_id))",
        head ? { count: "exact", head: true } : { count: "exact" },
      )
      .in("posts.social_posts.social_id", socialIds);
    if (postId) query = query.eq("post_id", postId);
    return query;
  };
  const from = (page - 1) * limit;
  const { data, error, count } = await scopedQuery()
    .order("commented_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + limit - 1);
  if (error?.code === "PGRST103") {
    // A page beyond the end has no rows; preserve its total without dropping scope.
    const result = await scopedQuery(true);
    if (result.error) throw result.error;
    if (result.count === null) throw new Error("Stored comment count unavailable");
    return { comments: [], totalCount: result.count };
  }
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
