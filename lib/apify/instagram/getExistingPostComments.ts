import { selectPostUrlsWithComments } from "@/lib/supabase/post_comments/selectPostUrlsWithComments";

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
    const withComments = await selectPostUrlsWithComments(postUrls);
    const urlsWithComments = Array.from(new Set(withComments));
    const withSet = new Set(urlsWithComments);
    const urlsWithoutComments = postUrls.filter(url => !withSet.has(url));

    return { urlsWithComments, urlsWithoutComments };
  } catch (error) {
    console.error("[ERROR] getExistingPostComments:", error);
    // Assume no comments exist on error so follow-up scrape still fires.
    return { urlsWithComments: [], urlsWithoutComments: postUrls };
  }
}
