import { asRecord } from "@/lib/apify/digest/asRecord";
import { asStringOrNull } from "@/lib/apify/digest/asStringOrNull";
import { asNumberOrNull } from "@/lib/apify/digest/asNumberOrNull";
import { buildPostStats } from "@/lib/apify/digest/buildPostStats";
import type { ScrapeDigestPost } from "@/lib/apify/digest/renderScrapeDigestHtml";

/** TikTok scraper dataset: one item per video. */
export function extractTiktokPosts(items: unknown[]): Map<string, ScrapeDigestPost> {
  const map = new Map<string, ScrapeDigestPost>();
  for (const raw of items) {
    const item = asRecord(raw);
    const url = asStringOrNull(item.webVideoUrl);
    if (!url) continue;
    const stats = buildPostStats({
      likes: asNumberOrNull(item.diggCount),
      comments: asNumberOrNull(item.commentCount),
      views: asNumberOrNull(item.playCount),
      shares: asNumberOrNull(item.shareCount),
    });
    map.set(url, {
      url,
      caption: asStringOrNull(item.text),
      thumbnailUrl: asStringOrNull(asRecord(item.videoMeta).coverUrl),
      timestamp: asStringOrNull(item.createTimeISO),
      ...(stats && { stats }),
    });
  }
  return map;
}
