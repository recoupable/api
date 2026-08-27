import apifyClient from "@/lib/apify/client";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { persistPostsForSocial } from "@/lib/apify/persistPostsForSocial";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { toIsoDate } from "@/lib/apify/toIsoDate";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/** Video/Short item from streamers~youtube-scraper (real shape, run T53twpAtFfFvAEiA3). */
type YoutubeVideoItem = {
  url?: string;
  date?: string;
  viewCount?: number;
  likes?: number;
  commentsCount?: number;
  inputChannelUrl?: string;
  channelUsername?: string;
  channelAvatarUrl?: string;
  channelDescription?: string;
  channelLocation?: string;
  channelTotalVideos?: number;
  numberOfSubscribers?: number;
  aboutChannelInfo?: { numberOfSubscribers?: number; channelTotalVideos?: number };
};

/**
 * Persists a YouTube channel scrape: the channel to `socials` (+ a follower
 * snapshot) and every returned video and Short to `posts`/`social_posts`
 * with view, like and comment counts (app#2018). Keyed on
 * `inputChannelUrl` — the exact URL this service passed to the actor —
 * because the actor's own `channelUrl` is the `/channel/UC…` form, which
 * would never match the stored `@handle` row (and would upsert a duplicate).
 *
 * With a posts depth the actor also emits a record for the channel's
 * `/about` page (`{ aboutChannelInfo, error, note, url }`, no
 * `inputChannelUrl`), often first (real run FyKpfOPuDsv4zSeRz). Only items
 * carrying `inputChannelUrl` are video items, so the channel comes from the
 * first of those and the `/about` url never becomes a post.
 */
export async function handleYoutubeProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const videos = (items as YoutubeVideoItem[]).filter(item => item?.inputChannelUrl);
  const first = videos[0];
  if (!first?.inputChannelUrl) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(first.inputChannelUrl),
    username: first.channelUsername,
    avatar: first.channelAvatarUrl ?? null,
    bio: first.channelDescription || null,
    followerCount: first.aboutChannelInfo?.numberOfSubscribers ?? first.numberOfSubscribers ?? null,
    region: first.channelLocation || null,
    postCount: first.aboutChannelInfo?.channelTotalVideos ?? first.channelTotalVideos ?? null,
  };
  await upsertSocialsWithSnapshot([social]);

  const postRows: TablesInsert<"posts">[] = videos.flatMap(item =>
    item.url
      ? [
          {
            post_url: item.url,
            updated_at: toIsoDate(item.date),
            views: item.viewCount ?? null,
            likes: item.likes ?? null,
            comments: item.commentsCount ?? null,
          },
        ]
      : [],
  );
  const newPostUrls = await filterNewPostUrls(postRows.map(p => p.post_url));
  const { posts } = await persistPostsForSocial({ postRows, profileUrl: social.profile_url });

  return { social, posts, newPostUrls };
}
