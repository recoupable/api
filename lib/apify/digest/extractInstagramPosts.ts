import { asRecord } from "@/lib/apify/digest/asRecord";
import { asStringOrNull } from "@/lib/apify/digest/asStringOrNull";
import { asNumberOrNull } from "@/lib/apify/digest/asNumberOrNull";
import { buildPostStats } from "@/lib/apify/digest/buildPostStats";
import type { ScrapeDigestPost } from "@/lib/apify/digest/renderScrapeDigestHtml";

/** Instagram profile-scraper dataset: posts ride on item[0].latestPosts. */
export function extractInstagramPosts(items: unknown[]): Map<string, ScrapeDigestPost> {
  const map = new Map<string, ScrapeDigestPost>();
  const latest = asRecord(items[0]).latestPosts;
  for (const raw of Array.isArray(latest) ? latest : []) {
    const post = asRecord(raw);
    const url = asStringOrNull(post.url);
    if (!url) continue;
    const stats = buildPostStats({
      likes: asNumberOrNull(post.likesCount),
      comments: asNumberOrNull(post.commentsCount),
      views: asNumberOrNull(post.videoViewCount),
    });
    map.set(url, {
      url,
      caption: asStringOrNull(post.caption),
      thumbnailUrl: asStringOrNull(post.displayUrl),
      timestamp: asStringOrNull(post.timestamp),
      ...(stats && { stats }),
    });
  }
  return map;
}
