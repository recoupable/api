import { getPosts } from "@/lib/supabase/posts/getPosts";

/**
 * Returns the subset of post URLs that are genuinely new to the platform —
 * i.e. not already present in `posts`. Must run BEFORE the scrape results are
 * upserted (afterwards everything exists and nothing is "new").
 *
 * Used to gate scrape-alert notifications: a scrape re-reads a profile's
 * whole recent feed, so without this diff every scrape re-announces old
 * posts as new (recoupable/chat#1855).
 *
 * @param postUrls - Candidate post URLs from a scrape result.
 * @returns URLs with no existing `posts` row.
 */
export async function filterNewPostUrls(postUrls: string[]): Promise<string[]> {
  if (!postUrls.length) return [];

  const existing = await getPosts({ postUrls });
  const known = new Set((existing ?? []).map(post => post.post_url));
  return postUrls.filter(url => !known.has(url));
}
