import type {
  ScrapeDigestPost,
  ScrapeDigestPostStats,
} from "@/lib/apify/digest/renderScrapeDigestHtml";

type Extractor = (items: unknown[]) => Map<string, ScrapeDigestPost>;

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

/** Drops the stats object entirely when the scraper returned no counts. */
const stats = (s: ScrapeDigestPostStats): ScrapeDigestPostStats | undefined =>
  Object.values(s).some(v => v != null)
    ? Object.fromEntries(Object.entries(s).filter(([, v]) => v != null))
    : undefined;

/** Instagram profile-scraper dataset: posts ride on item[0].latestPosts. */
const instagram: Extractor = items => {
  const map = new Map<string, ScrapeDigestPost>();
  const latest = asRecord(items[0]).latestPosts;
  for (const raw of Array.isArray(latest) ? latest : []) {
    const post = asRecord(raw);
    const url = str(post.url);
    if (!url) continue;
    const postStats = stats({
      likes: num(post.likesCount),
      comments: num(post.commentsCount),
      views: num(post.videoViewCount),
    });
    map.set(url, {
      url,
      caption: str(post.caption),
      thumbnailUrl: str(post.displayUrl),
      timestamp: str(post.timestamp),
      ...(postStats && { stats: postStats }),
    });
  }
  return map;
};

/** TikTok scraper dataset: one item per video. */
const tiktok: Extractor = items => {
  const map = new Map<string, ScrapeDigestPost>();
  for (const raw of items) {
    const item = asRecord(raw);
    const url = str(item.webVideoUrl);
    if (!url) continue;
    const videoStats = stats({
      likes: num(item.diggCount),
      comments: num(item.commentCount),
      views: num(item.playCount),
      shares: num(item.shareCount),
    });
    map.set(url, {
      url,
      caption: str(item.text),
      thumbnailUrl: str(asRecord(item.videoMeta).coverUrl),
      timestamp: str(item.createTimeISO),
      ...(videoStats && { stats: videoStats }),
    });
  }
  return map;
};

const EXTRACTORS: Record<string, Extractor> = { instagram, tiktok };

/**
 * Builds rich digest posts (caption, media, timestamp) for a platform's
 * genuinely-new post URLs from its raw scraper dataset items. Platforms
 * without an extractor — and URLs missing from the items — degrade to
 * URL-only posts, so enrichment can never lose a link (chat#1855).
 */
export function extractPostsFromDatasetItems(
  platform: string,
  items: unknown[],
  newPostUrls: string[],
): ScrapeDigestPost[] {
  const extractor = EXTRACTORS[platform.toLowerCase()];
  const byUrl = extractor ? extractor(items) : new Map<string, ScrapeDigestPost>();
  return newPostUrls.map(url => byUrl.get(url) ?? { url });
}
