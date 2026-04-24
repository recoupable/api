import { getDataset } from "@/lib/apify/getDataset";
import { saveApifyInstagramComments } from "@/lib/apify/instagram/saveApifyInstagramComments";
import { startInstagramProfileScraping } from "@/lib/apify/instagram/startInstagramProfileScraping";
import type { ApifyPayload } from "@/lib/apify/apifyPayloadSchema";
import type { ApifyInstagramComment } from "@/lib/apify/types";

/**
 * Handles Instagram comments scraper Apify webhook results:
 *  - Persists comments into `post_comments`.
 *  - Kicks off a fan-profile scrape for the distinct commenter
 *    usernames so their socials get indexed.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleInstagramCommentsScraper(parsed: ApifyPayload) {
  const datasetId = parsed.resource.defaultDatasetId;
  const empty = {
    comments: [] as ApifyInstagramComment[],
    processedPostUrls: [] as string[],
    totalComments: 0,
  };

  if (!datasetId) return empty;

  try {
    const dataset = await getDataset(datasetId);
    if (!Array.isArray(dataset)) return empty;

    const comments = dataset as ApifyInstagramComment[];
    const processedPostUrls = Array.from(new Set(comments.map(c => c.postUrl).filter(Boolean)));
    const totalComments = comments.length;

    await saveApifyInstagramComments(comments);

    const fanHandles = Array.from(new Set(comments.map(c => c.ownerUsername).filter(Boolean)));

    if (fanHandles.length > 0) {
      try {
        await startInstagramProfileScraping(fanHandles);
      } catch (error) {
        console.error("[ERROR] fan profile scrape failed:", error);
      }
    }

    return { comments, processedPostUrls, totalComments };
  } catch (error) {
    console.error("[ERROR] handleInstagramCommentsScraper:", error);
    return empty;
  }
}
