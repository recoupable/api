import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Post item from clockworks~tiktok-scraper (real shape, run G4YRI0eUI0d5IidDN). */
type TiktokPostItem = {
  authorMeta?: {
    name?: string;
    profileUrl?: string;
    avatar?: string;
    signature?: string;
    fans?: number;
    following?: number;
  };
};

/**
 * Persists a TikTok profile scrape back to `socials` (upsert on `profile_url`).
 * The actor returns post items; the author's profile stats ride on
 * `authorMeta` of any item.
 */
export async function handleTiktokProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const author = (items[0] as TiktokPostItem | undefined)?.authorMeta;
  if (!author?.profileUrl) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(author.profileUrl),
    username: author.name,
    avatar: author.avatar ?? null,
    bio: author.signature || null,
    followerCount: author.fans ?? null,
    followingCount: author.following ?? null,
  };
  await upsertSocials([social]);
  return { social };
}
