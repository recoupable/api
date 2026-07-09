import { extractInstagramPosts } from "@/lib/apify/digest/extractInstagramPosts";
import { extractTiktokPosts } from "@/lib/apify/digest/extractTiktokPosts";
import type { ScrapeDigestPost } from "@/lib/apify/digest/renderScrapeDigestHtml";

const EXTRACTORS: Record<string, (items: unknown[]) => Map<string, ScrapeDigestPost>> = {
  instagram: extractInstagramPosts,
  tiktok: extractTiktokPosts,
};

/**
 * Builds rich digest posts (caption, media, stats, timestamp) for a
 * platform's genuinely-new post URLs from its raw scraper dataset items.
 * Platforms without an extractor — and URLs missing from the items —
 * degrade to URL-only posts, so enrichment can never lose a link (chat#1855).
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
