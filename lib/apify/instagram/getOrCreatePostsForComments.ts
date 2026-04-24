import { insertPosts } from "@/lib/supabase/posts/insertPosts";
import { getPostsByUrls } from "@/lib/supabase/posts/getPostsByUrls";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Ensures a `posts` row exists for every post URL the comment scraper
 * produced, creating any missing rows with `updated_at = now()`. Returns
 * a map keyed by `post_url` for efficient lookup during comment insert.
 *
 * @param postUrls - Instagram post URLs referenced by incoming comments.
 */
export async function getOrCreatePostsForComments(
  postUrls: string[],
): Promise<Map<string, Tables<"posts">>> {
  const unique = Array.from(new Set(postUrls.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const existing = await getPostsByUrls(unique);
  const existingSet = new Set(existing.map(p => p.post_url));

  const missing = unique.filter(url => !existingSet.has(url));
  if (missing.length > 0) {
    const rows: TablesInsert<"posts">[] = missing.map(url => ({
      post_url: url,
      updated_at: new Date().toISOString(),
    }));
    await insertPosts(rows);
  }

  const all = await getPostsByUrls(unique);
  const map = new Map<string, Tables<"posts">>();
  all.forEach(post => {
    map.set(post.post_url, post);
  });
  return map;
}
