import { formatCompactCount } from "@/lib/apify/digest/formatCompactCount";
import type { ScrapeDigestPostStats } from "@/lib/apify/digest/renderScrapeDigestHtml";

/** "12.3K likes · 678 comments · 1.2M views" from whichever stats exist. */
export function formatPostStats(stats: ScrapeDigestPostStats): string {
  const parts: string[] = [];
  if (stats.likes != null) parts.push(`${formatCompactCount(stats.likes)} likes`);
  if (stats.comments != null) parts.push(`${formatCompactCount(stats.comments)} comments`);
  if (stats.views != null) parts.push(`${formatCompactCount(stats.views)} views`);
  if (stats.shares != null) parts.push(`${formatCompactCount(stats.shares)} shares`);
  return parts.join(" · ");
}
