import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Persists one Apify actor run's results (posts/socials/etc.). */
export type ApifyResultHandler = (parsed: ApifyWebhookPayload) => Promise<unknown>;

/**
 * Apify actor id (from the webhook `eventData.actorId`) → the handler that
 * persists that actor's results. Registry, so adding a platform is a single
 * entry rather than another `switch` arm.
 *
 * Only the Instagram actors are wired today — TikTok/X/YouTube/Threads/Facebook
 * (and LinkedIn) scrapes run and return data on the poll endpoint but are NOT
 * persisted yet. Each needs a `handle<Platform>ProfileScraperResults` (mirror
 * the Instagram one) registered here under its resolved actor id. See
 * recoupable/chat#1833 ("persist non-Instagram scrape results").
 */
const HANDLERS_BY_ACTOR_ID: Record<string, ApifyResultHandler> = {
  dSCLg0C3YEZ83HzYX: handleInstagramProfileScraperResults, // instagram profile
  SbK00X0JYCPblD2wp: handleInstagramCommentsScraper, // instagram comments
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
