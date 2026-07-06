import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** User item from apidojo~twitter-user-scraper (real shape verified on a live
 * run 2026-07-06, twitterHandles: ["ashnikko"]). The actor returns the
 * requested user AND pads the dataset with related users, so results must be
 * filtered to the requested handle before persisting. */
type TwitterUserItem = {
  type?: string;
  userName?: string;
  url?: string;
  profilePicture?: string;
  description?: string;
  location?: string;
  followers?: number;
  following?: number;
};

/**
 * Persists a profile-level X/Twitter scrape (the tweetless-account fallback,
 * chat#1851) back to `socials`. Reads the run INPUT to recover the requested
 * handle, filters the dataset to that user (the actor pads with related
 * users), and upserts with a lowercased profile_url — X handles are
 * case-insensitive and stored rows are lowercase.
 */
export async function handleTwitterUserScraperResults(parsed: ApifyWebhookPayload) {
  const storeId = parsed.resource.defaultKeyValueStoreId;
  if (!storeId) return { social: null };

  const inputRecord = await apifyClient.keyValueStore(storeId).getRecord("INPUT");
  const input = inputRecord?.value as { twitterHandles?: string[] } | undefined;
  const requestedHandle = input?.twitterHandles?.[0]?.trim();
  if (!requestedHandle) return { social: null };

  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const user = (items as TwitterUserItem[]).find(
    item => item.userName?.toLowerCase() === requestedHandle.toLowerCase(),
  );
  if (!user?.url) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(user.url).toLowerCase(),
    username: user.userName,
    avatar: user.profilePicture ?? null,
    bio: user.description || null,
    followerCount: user.followers ?? null,
    followingCount: user.following ?? null,
    region: user.location || null,
  };
  await upsertSocials([social]);

  return { social };
}
