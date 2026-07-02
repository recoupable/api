import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** Video item from streamers~youtube-scraper (real shape, run H0ZrIAsJJYXLpCAp7). */
type YoutubeVideoItem = {
  inputChannelUrl?: string;
  channelUsername?: string;
  channelAvatarUrl?: string;
  channelDescription?: string;
  channelLocation?: string;
  aboutChannelInfo?: { numberOfSubscribers?: number };
};

/**
 * Persists a YouTube channel scrape back to `socials`. Keyed on
 * `inputChannelUrl` — the exact URL this service passed to the actor —
 * because the actor's own `channelUrl` is the `/channel/UC…` form, which
 * would never match the stored `@handle` row (and would upsert a duplicate).
 */
export async function handleYoutubeProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const first = items[0] as YoutubeVideoItem | undefined;
  if (!first?.inputChannelUrl) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(first.inputChannelUrl),
    username: first.channelUsername,
    avatar: first.channelAvatarUrl ?? null,
    bio: first.channelDescription || null,
    followerCount: first.aboutChannelInfo?.numberOfSubscribers ?? null,
    region: first.channelLocation || null,
  };
  await upsertSocials([social]);
  return { social };
}
