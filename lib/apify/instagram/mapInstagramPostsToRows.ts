import type { ApifyInstagramPost } from "@/lib/apify/types";
import type { TablesInsert } from "@/types/database.types";

/**
 * `latestPosts` of a profile item → `posts` rows with the engagement the
 * profile scraper reports (likes, comments; no view count on this actor).
 * Items without a URL are dropped.
 */
export function mapInstagramPostsToRows(
  latestPosts: Partial<ApifyInstagramPost>[] | undefined,
): TablesInsert<"posts">[] {
  return (latestPosts ?? []).flatMap(post =>
    post.url
      ? [
          {
            post_url: post.url,
            updated_at: post.timestamp,
            likes: post.likesCount ?? null,
            comments: post.commentsCount ?? null,
          },
        ]
      : [],
  );
}
