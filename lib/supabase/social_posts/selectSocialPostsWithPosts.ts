import supabase from "../serverClient";

export async function selectSocialPostsWithPosts({
  social_id,
  offset,
  limit,
  latestFirst,
}: {
  social_id: string;
  offset: number;
  limit: number;
  latestFirst: boolean;
}) {
  // Order on social_posts.updated_at (not posts.updated_at) to match legacy
  // Express behavior — the embedded post.updated_at often mirrors it but they
  // are different columns and only sorting the outer row is safe.
  const { data, error } = await supabase
    .from("social_posts")
    .select("id, post_id, social_id, updated_at, post:posts(id, post_url, updated_at)")
    .eq("social_id", social_id)
    .order("updated_at", { ascending: !latestFirst })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch social_posts: ${error.message}`);
  }

  return data ?? [];
}
