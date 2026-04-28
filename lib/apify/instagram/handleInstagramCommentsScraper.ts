import apifyClient from "@/lib/apify/client";
import { saveApifyInstagramComments } from "@/lib/apify/instagram/saveApifyInstagramComments";
import { startInstagramProfileScraping } from "@/lib/apify/instagram/startInstagramProfileScraping";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { ApifyInstagramComment } from "@/lib/apify/types";

/**
 * Handles Instagram comments scraper Apify webhook results:
 *  - Persists comments into `post_comments`.
 *  - Kicks off a fan-profile scrape for the distinct commenter
 *    usernames so their socials get indexed (best-effort: failures
 *    are logged but don't fail the comments ingestion).
 *
 * Errors from the dataset fetch or comment persistence propagate up
 * to the webhook route, which logs and returns an error response.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleInstagramCommentsScraper(parsed: ApifyWebhookPayload) {
  const datasetId = parsed.resource.defaultDatasetId;
  const empty = {
    comments: [] as ApifyInstagramComment[],
    processedPostUrls: [] as string[],
    totalComments: 0,
  };

  if (!datasetId) return empty;

  const { items } = await apifyClient.dataset(datasetId).listItems();
  const comments = items as ApifyInstagramComment[];
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
}
