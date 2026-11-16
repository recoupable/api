import apifyClient from "@/lib/apify/client";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo, ApifyRunLineage } from "@/lib/apify/types";
import { getLinkedinCompanyUrl } from "@/lib/apify/linkedin/getLinkedinCompanyUrl";

/**
 * Starts a LinkedIn scrape via the harvestapi actors.
 * Mirrors the other `start<Platform>ProfileScraping` modules.
 *
 * The profile actor's dataset has no post fields, so a requested `posts`
 * depth switches to the posts actor (post items with engagement counts) —
 * the same semantics as X/YouTube: depth requested → post items in the
 * dataset; omitted → the legacy profile snapshot.
 *
 * Company pages keep their `/company/` URL (app#2398): the posts actor takes
 * company URLs as-is, and without a posts depth they run the company details
 * actor, since the profile actor only reads personal profiles.
 *
 * @param handle - A LinkedIn vanity slug (e.g. `drew-thurlow`), full profile URL or company page URL.
 * @param posts - Max recent posts to scrape; omitted → profile snapshot.
 * @returns Apify run info, or null if the run failed to start.
 * @see https://apify.com/harvestapi/linkedin-profile-scraper
 * @see https://apify.com/harvestapi/linkedin-profile-posts
 * @see https://apify.com/harvestapi/linkedin-company
 */
const startLinkedinProfileScraping = async (
  handle: string,
  posts?: number,
  lineage: ApifyRunLineage = { origin: "artist" },
): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");
  // Legacy rows stored the LinkedIn path prefix ("in") as the username — never
  // scrape those (linkedin.com/in/in is a real, wrong profile URL); fail loudly.
  if (!cleanHandle || ["in", "company", "school"].includes(cleanHandle.toLowerCase())) {
    throw new Error(`Invalid LinkedIn handle: "${handle}"`);
  }

  const companyUrl = getLinkedinCompanyUrl(cleanHandle);
  const targetUrl =
    companyUrl ??
    (cleanHandle.startsWith("http") ? cleanHandle : `https://www.linkedin.com/in/${cleanHandle}`);

  const { actorId, input } =
    posts !== undefined
      ? {
          actorId: "harvestapi/linkedin-profile-posts",
          input: { targetUrls: [targetUrl], maxPosts: posts },
        }
      : companyUrl
        ? { actorId: "harvestapi/linkedin-company", input: { companies: [targetUrl] } }
        : { actorId: "harvestapi/linkedin-profile-scraper", input: { urls: [targetUrl] } };

  try {
    const run = await apifyClient
      .actor(actorId)
      .start(input, { webhooks: getApifyWebhooks(lineage) });

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
