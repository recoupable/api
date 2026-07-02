import apifyClient from "@/lib/apify/client";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo } from "@/lib/apify/types";

/**
 * Starts a LinkedIn scrape via the harvestapi actors.
 * Mirrors the other `start<Platform>ProfileScraping` modules.
 *
 * The profile actor's dataset has no post fields, so a requested `posts`
 * depth switches to the posts actor (post items with engagement counts) —
 * the same semantics as X/YouTube: depth requested → post items in the
 * dataset; omitted → the legacy profile snapshot.
 *
 * @param handle - A LinkedIn vanity slug (e.g. `drew-thurlow`) or full profile URL.
 * @param posts - Max recent posts to scrape; omitted → profile snapshot.
 * @returns Apify run info, or null if the run failed to start.
 * @see https://apify.com/harvestapi/linkedin-profile-scraper
 * @see https://apify.com/harvestapi/linkedin-profile-posts
 */
const startLinkedinProfileScraping = async (
  handle: string,
  posts?: number,
): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");
  // Legacy rows stored the LinkedIn path prefix ("in") as the username — never
  // scrape those (linkedin.com/in/in is a real, wrong profile URL); fail loudly.
  if (!cleanHandle || ["in", "company", "school"].includes(cleanHandle.toLowerCase())) {
    throw new Error(`Invalid LinkedIn handle: "${handle}"`);
  }

  const targetUrl = cleanHandle.startsWith("http")
    ? cleanHandle
    : `https://www.linkedin.com/in/${cleanHandle}`;

  const actorId =
    posts === undefined
      ? "harvestapi/linkedin-profile-scraper"
      : "harvestapi/linkedin-profile-posts";
  const input =
    posts === undefined ? { urls: [targetUrl] } : { targetUrls: [targetUrl], maxPosts: posts };

  try {
    const run = await apifyClient.actor(actorId).start(input, { webhooks: getApifyWebhooks() });

    if (!run?.id || !run?.defaultDatasetId) {
      console.error("Failed to start LinkedIn profile scraping for handle:", handle);
      return null;
    }

    if (run.status === "FAILED" || run.status === "ABORTED") {
      throw new Error(OUTSTANDING_ERROR);
    }

    return { runId: run.id, datasetId: run.defaultDatasetId };
  } catch (error) {
    console.error("Error in startLinkedinProfileScraping:", error);
    throw error;
  }
};

export default startLinkedinProfileScraping;
