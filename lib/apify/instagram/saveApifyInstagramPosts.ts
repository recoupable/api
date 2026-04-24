import { insertPosts } from "@/lib/supabase/posts/insertPosts";
import { getPostsByUrls } from "@/lib/supabase/posts/getPostsByUrls";
import type { ApifyInstagramPost } from "@/lib/apify/types";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upserts an array of Apify Instagram posts into Supabase and returns
 * the resulting rows.
 *
 * @param apifyPosts - Posts from the Apify Instagram profile scraper.
 * @returns Object with Supabase `posts` rows for the provided URLs.
 */
export async function saveApifyInstagramPosts(
  apifyPosts: ApifyInstagramPost[],
): Promise<{ supabasePosts: Tables<"posts">[] }> {
  if (!apifyPosts?.length) return { supabasePosts: [] };

  const rows: TablesInsert<"posts">[] = apifyPosts.map(post => ({
    post_url: post.url,
    updated_at: post.timestamp,
  }));
  const postUrls = rows.map(p => p.post_url);

  await insertPosts(rows);

  const supabasePosts = await getPostsByUrls(postUrls);
  return { supabasePosts };
}
