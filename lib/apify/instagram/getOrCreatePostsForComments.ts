import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import type { Tables } from "@/types/database.types";

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

  const existing = await getPosts({ postUrls: unique });
  const missing = unique.filter(url => !existing.some(p => p.post_url === url));

  let all = existing;
  if (missing.length > 0) {
    const now = new Date().toISOString();
    await upsertPosts(missing.map(url => ({ post_url: url, updated_at: now })));
    all = await getPosts({ postUrls: unique });
  }

  return new Map(all.map(post => [post.post_url, post]));
}
