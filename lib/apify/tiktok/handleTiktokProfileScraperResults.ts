import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { persistPostsForSocial } from "@/lib/apify/persistPostsForSocial";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/** Post item from clockworks~tiktok-scraper (real shape, run G4YRI0eUI0d5IidDN;
 * post fields verified on run 9AYX8xyaHWyHtnGtC). */
type TiktokPostItem = {
  webVideoUrl?: string;
  createTimeISO?: string;
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
 * Persists a TikTok profile scrape back to `socials` (upsert on `profile_url`)
 * and the returned post items to `posts`/`social_posts` (chat#1840). The
 * actor returns post items; the author's profile stats ride on
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

  const postRows: TablesInsert<"posts">[] = (items as TiktokPostItem[]).flatMap(item =>
    item.webVideoUrl ? [{ post_url: item.webVideoUrl, updated_at: item.createTimeISO }] : [],
  );
  const { posts } = await persistPostsForSocial({ postRows, profileUrl: social.profile_url });

  return { social, posts };
}
