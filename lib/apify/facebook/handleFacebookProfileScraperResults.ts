import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Page item from apify~facebook-pages-scraper (real shape, run ICZxdJBrtP1jkPITS). */
type FacebookPageItem = {
  pageUrl?: string;
  facebookUrl?: string;
  pageName?: string;
  profilePictureUrl?: string;
  followers?: number;
};

/** Persists a Facebook page scrape back to `socials` (upsert on `profile_url`). */
export async function handleFacebookProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const first = items[0] as FacebookPageItem | undefined;
  const url = first?.pageUrl ?? first?.facebookUrl;
  if (!url) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(url),
    username: first?.pageName,
    avatar: first?.profilePictureUrl ?? null,
    followerCount: first?.followers ?? null,
  };
  await upsertSocials([social]);
  return { social };
}
