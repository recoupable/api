import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Profile item from apify~threads-profile-api-scraper (real shape, run 9iiG1sDkpaeWPCWHl). */
type ThreadsProfileItem = {
  username?: string;
  url?: string;
  profile_pic_url?: string;
  biography?: string;
  follower_count?: number;
};

/** Persists a Threads profile scrape back to `socials` (upsert on `profile_url`). */
export async function handleThreadsProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const first = items[0] as ThreadsProfileItem | undefined;
  if (!first?.url) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(first.url),
    username: first.username,
    avatar: first.profile_pic_url ?? null,
    bio: first.biography || null,
    followerCount: first.follower_count ?? null,
  };
  await upsertSocials([social]);
  return { social };
}
