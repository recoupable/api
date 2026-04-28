import type { ApifyBody } from "@/lib/apify/validateApifyBody";
import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";

const INSTAGRAM_PROFILE_ACTOR_ID = "dSCLg0C3YEZ83HzYX";
const INSTAGRAM_COMMENTS_ACTOR_ID = "SbK00X0JYCPblD2wp";

const fallbackResponse = {
  posts: [],
  social: null,
  accountSocials: [],
  accountArtistIds: [],
  accountEmails: [],
  sentEmails: null,
};

/**
 * Dispatches an Apify webhook payload to the handler matching the
 * `eventData.actorId`. Unknown actor ids are logged and return an
 * empty-shaped response. Never throws — handler failures are caught
 * and logged so the webhook route can always reply 200.
 *
 * @param parsed - Validated Apify webhook body.
 */
export async function handleApifyWebhook(parsed: ApifyBody) {
  try {
    switch (parsed.eventData.actorId) {
      case INSTAGRAM_PROFILE_ACTOR_ID:
        return await handleInstagramProfileScraperResults(parsed);
      case INSTAGRAM_COMMENTS_ACTOR_ID:
        return await handleInstagramCommentsScraper(parsed);
      default:
        console.log(`[WARN] handleApifyWebhook: unhandled actorId ${parsed.eventData.actorId}`);
        return fallbackResponse;
    }
  } catch (e) {
    console.error("[ERROR] handleApifyWebhook:", e);
    return fallbackResponse;
  }
}
