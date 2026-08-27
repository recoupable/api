import apifyClient from "@/lib/apify/client";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { persistPostsForSocial } from "@/lib/apify/persistPostsForSocial";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { toIsoDate } from "@/lib/apify/toIsoDate";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/** Post item from clockworks~tiktok-scraper (real shape, run bliCVetR7cqgmpvBu, 2026-08-27). */
type TiktokPostItem = {
  webVideoUrl?: string;
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  authorMeta?: {
    name?: string;
    profileUrl?: string;
    avatar?: string;
    signature?: string;
    fans?: number;
    following?: number;
    video?: number;
  };
};

/**
 * Persists a TikTok profile scrape back to `socials` (upsert on `profile_url`,
 * plus a follower snapshot) and the returned post items to `posts`/
 * `social_posts` with play/like/comment/share counts (chat#1840, app#2018).
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
    postCount: author.video ?? null,
  };
  await upsertSocialsWithSnapshot([social]);

  const postRows: TablesInsert<"posts">[] = (items as TiktokPostItem[]).flatMap(item =>
    item.webVideoUrl
      ? [
          {
            post_url: item.webVideoUrl,
            updated_at: toIsoDate(item.createTimeISO),
            views: item.playCount ?? null,
            likes: item.diggCount ?? null,
            comments: item.commentCount ?? null,
            reposts: item.shareCount ?? null,
          },
        ]
      : [],
  );
  // Diff before persisting so the digest can report genuinely new posts (chat#1855).
  const newPostUrls = await filterNewPostUrls(postRows.map(p => p.post_url));
  const { posts } = await persistPostsForSocial({ postRows, profileUrl: social.profile_url });

  return { social, posts, newPostUrls };
}
