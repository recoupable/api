import { selectPostComments } from "@/lib/supabase/post_comments/selectPostComments";

/**
 * Partitions `postUrls` into those that already have comments in
 * Supabase and those that do not. Used by the follow-up-runs handler
 * to decide whether to throttle the comments scraper for known posts.
 *
 * @param postUrls - Instagram post URLs to check.
 */
export async function getExistingPostComments(postUrls: string[]): Promise<{
  urlsWithComments: string[];
  urlsWithoutComments: string[];
}> {
  if (!postUrls || postUrls.length === 0) {
    return { urlsWithComments: [], urlsWithoutComments: [] };
  }

  try {
    const existing = await selectPostComments({ postUrls });

    const withComments = existing
      .map(c => c.post?.post_url)
      .filter((url): url is string => Boolean(url));

    const urlsWithComments = Array.from(new Set(withComments));
    const urlsWithoutComments = postUrls.filter(url => !urlsWithComments.includes(url));

    return { urlsWithComments, urlsWithoutComments };
  } catch (error) {
    console.error("[ERROR] getExistingPostComments:", error);
    // Assume no comments exist on error so follow-up scrape still fires.
    return { urlsWithComments: [], urlsWithoutComments: postUrls };
  }
}
