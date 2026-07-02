import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";
import { handleLinkedinProfileScraperResults } from "@/lib/apify/linkedin/handleLinkedinProfileScraperResults";
import { handleTiktokProfileScraperResults } from "@/lib/apify/tiktok/handleTiktokProfileScraperResults";
import { handleTwitterProfileScraperResults } from "@/lib/apify/twitter/handleTwitterProfileScraperResults";
import { handleYoutubeProfileScraperResults } from "@/lib/apify/youtube/handleYoutubeProfileScraperResults";
import { handleThreadsProfileScraperResults } from "@/lib/apify/threads/handleThreadsProfileScraperResults";
import { handleFacebookProfileScraperResults } from "@/lib/apify/facebook/handleFacebookProfileScraperResults";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Persists one Apify actor run's results (posts/socials/etc.). */
export type ApifyResultHandler = (parsed: ApifyWebhookPayload) => Promise<unknown>;

/**
 * Apify actor id (from the webhook `eventData.actorId`) → the handler that
 * persists that actor's results. Registry, so adding a platform is a single
 * entry rather than another `switch` arm.
 *
 * All supported platforms are wired: each start module attaches
 * `getApifyWebhooks()` to its run and registers its resolved actor id here. Each needs a `handle<Platform>ProfileScraperResults` (mirror
 * the Instagram one) registered here under its resolved actor id. See
 * recoupable/chat#1833 ("persist non-Instagram scrape results").
 */
const HANDLERS_BY_ACTOR_ID: Record<string, ApifyResultHandler> = {
  dSCLg0C3YEZ83HzYX: handleInstagramProfileScraperResults, // instagram profile
  SbK00X0JYCPblD2wp: handleInstagramCommentsScraper, // instagram comments
  LpVuK3Zozwuipa5bp: handleLinkedinProfileScraperResults, // linkedin profile (harvestapi)
  GdWCkxBtKWOsKjdch: handleTiktokProfileScraperResults, // tiktok (clockworks~tiktok-scraper)
  nfp1fpt5gUlBwPcor: handleTwitterProfileScraperResults, // x/twitter (apidojo~twitter-scraper-lite)
  h7sDV53CddomktSi5: handleYoutubeProfileScraperResults, // youtube (streamers~youtube-scraper)
  kJdK90pa2hhYYrCK5: handleThreadsProfileScraperResults, // threads (apify~threads-profile-api-scraper)
  "4Hv5RhChiaDk6iwad": handleFacebookProfileScraperResults, // facebook (apify~facebook-pages-scraper)
};

/**
 * Look up the result handler for an Apify actor id.
 *
 * @param actorId - `eventData.actorId` from the Apify webhook payload.
 * @returns The registered handler, or undefined if the actor isn't wired.
 */
export function getApifyResultHandler(actorId: string): ApifyResultHandler | undefined {
  return HANDLERS_BY_ACTOR_ID[actorId];
}
