import { toIsoDate } from "@/lib/apify/toIsoDate";
import { mapInstagramPostMedia } from "@/lib/apify/instagram/mapInstagramPostMedia";
import type { ApifyInstagramPost } from "@/lib/apify/types";
import type { TablesInsert } from "@/types/database.types";

/**
 * `latestPosts` of a profile item → `posts` rows with the engagement the
 * profile scraper reports (likes, comments; no view count on this actor)
 * plus the caption, publish date and provider media references it already
 * returns (recoupable/app#2132). Items without a URL are dropped.
 *
 * Retention columns are only named when the run reported them, so rows in
 * one run can carry different keys; upsertPosts writes each column set in
 * its own call, so a degraded scrape never erases a caption or media an
 * earlier run retained. `media_observed_at` marks when caption or media
 * were last written, not when engagement was refreshed.
 *
 * @param latestPosts - Profile actor items
 * @param observedAt - ISO timestamp stamped on rows that carry caption/media
 */
export function mapInstagramPostsToRows(
  latestPosts: Partial<ApifyInstagramPost>[] | undefined,
  observedAt = new Date().toISOString(),
): TablesInsert<"posts">[] {
  return (latestPosts ?? []).flatMap(post => {
    if (!post.url) return [];
    const { caption, published_at, media } = mapInstagramPostMedia(post);
    const retained = caption !== null || media.length > 0;
    return [
      {
        post_url: post.url,
        updated_at: toIsoDate(post.timestamp),
        likes: post.likesCount ?? null,
        comments: post.commentsCount ?? null,
        ...(caption !== null ? { caption } : {}),
        ...(published_at ? { published_at } : {}),
        ...(media.length ? { media } : {}),
        ...(retained ? { media_observed_at: observedAt } : {}),
      },
    ];
  });
}
