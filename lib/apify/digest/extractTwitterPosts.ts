import { asRecord } from "@/lib/apify/digest/asRecord";
import { asStringOrNull } from "@/lib/apify/digest/asStringOrNull";
import { asNumberOrNull } from "@/lib/apify/digest/asNumberOrNull";
import { buildPostStats } from "@/lib/apify/digest/buildPostStats";
import { toIsoDate } from "@/lib/apify/toIsoDate";
import type { ScrapeDigestPost } from "@/lib/apify/digest/renderScrapeDigestHtml";

/** X/Twitter scraper dataset (apidojo): one item per tweet. */
export function extractTwitterPosts(items: unknown[]): Map<string, ScrapeDigestPost> {
  const map = new Map<string, ScrapeDigestPost>();
  for (const raw of items) {
    const item = asRecord(raw);
    const url = asStringOrNull(item.url);
    if (!url) continue;
    const media = asRecord(item.extendedEntities).media;
    const firstMedia = asRecord(Array.isArray(media) ? media[0] : undefined);
    const stats = buildPostStats({
      likes: asNumberOrNull(item.likeCount),
      comments: asNumberOrNull(item.replyCount),
      views: asNumberOrNull(item.viewCount),
      shares: asNumberOrNull(item.retweetCount),
    });
    map.set(url, {
      url,
      caption: asStringOrNull(item.fullText) ?? asStringOrNull(item.text),
      thumbnailUrl: asStringOrNull(firstMedia.media_url_https),
      timestamp: toIsoDate(asStringOrNull(item.createdAt) ?? undefined) ?? null,
      ...(stats && { stats }),
    });
  }
  return map;
}
