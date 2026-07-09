import apifyClient from "@/lib/apify/client";
import { parseNewPostUrls } from "@/lib/apify/digest/parseNewPostUrls";
import { extractPostsFromDatasetItems } from "@/lib/apify/digest/extractPostsFromDatasetItems";
import { extractArtistNameFromDatasetItems } from "@/lib/apify/digest/extractArtistNameFromDatasetItems";
import type { ScrapeDigestSection } from "@/lib/apify/digest/renderScrapeDigestHtml";
import type { Tables } from "@/types/database.types";

/** A digest section plus the profile display name the platform reported. */
export type RunDigestSection = ScrapeDigestSection & { artistName: string | null };

/**
 * Builds one platform's digest section for a completed scrape run, enriching
 * the stored genuinely-new URLs with caption/media/stats and the profile's
 * display name by re-reading the run's dataset from Apify (the source of
 * truth for scrape content — only the URL diff is persisted, chat#1855).
 * Enrichment must never block the digest: any failure degrades to URL-only
 * posts. Returns null when the run found nothing new.
 */
export async function getRunDigestSection(
  run: Tables<"apify_scraper_runs">,
): Promise<RunDigestSection | null> {
  const urls = parseNewPostUrls(run.new_post_urls);
  if (!urls.length) return null;
  const platform = run.platform ?? "other";

  try {
    const runInfo = await apifyClient.run(run.run_id).get();
    const datasetId = runInfo?.defaultDatasetId;
    if (!datasetId) return { platform, posts: urls.map(url => ({ url })), artistName: null };
    const { items } = await apifyClient.dataset(datasetId).listItems();
    return {
      platform,
      posts: extractPostsFromDatasetItems(platform, items, urls),
      artistName: extractArtistNameFromDatasetItems(platform, items),
    };
  } catch (error) {
    console.error("[WARN] digest enrichment failed; sending URL-only links:", error);
    return { platform, posts: urls.map(url => ({ url })), artistName: null };
  }
}
