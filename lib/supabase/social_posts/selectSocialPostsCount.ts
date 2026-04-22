import supabase from "../serverClient";

export async function selectSocialPostsCount(social_id: string): Promise<number> {
  const { count, error } = await supabase
    .from("social_posts")
    .select("*", { count: "exact", head: true })
    .eq("social_id", social_id);

  if (error) {
    throw new Error(`Failed to fetch social_posts count: ${error.message}`);
  }

  return count ?? 0;
}
