import type { ScrapeDigestPostStats } from "@/lib/apify/digest/renderScrapeDigestHtml";

/** Prunes null counts; returns undefined when the scraper reported none. */
export function buildPostStats(stats: ScrapeDigestPostStats): ScrapeDigestPostStats | undefined {
  return Object.values(stats).some(v => v != null)
    ? Object.fromEntries(Object.entries(stats).filter(([, v]) => v != null))
    : undefined;
}
