import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Tweet item from apidojo~twitter-scraper-lite (real shape, run ALVMZYXkh3WHgeGfT). */
type TweetItem = {
  author?: {
    userName?: string;
    url?: string;
    profilePicture?: string;
    description?: string;
    location?: string;
    followers?: number;
    following?: number;
  };
};

/**
 * Persists an X/Twitter profile scrape back to `socials`. The actor returns
 * tweet items; profile stats ride on `author`. The URL is lowercased —
 * X handles are case-insensitive and the actor echoes display casing
 * (`x.com/TheASF`) while stored rows are lowercase (`x.com/theasf`);
 * without this the upsert would create a duplicate row.
 */
export async function handleTwitterProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const author = (items[0] as TweetItem | undefined)?.author;
  if (!author?.url) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(author.url).toLowerCase(),
    username: author.userName,
    avatar: author.profilePicture ?? null,
    bio: author.description || null,
    followerCount: author.followers ?? null,
    followingCount: author.following ?? null,
    region: author.location || null,
  };
  await upsertSocials([social]);
  return { social };
}
