import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { persistPostsForSocial } from "@/lib/apify/persistPostsForSocial";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { toIsoDate } from "@/lib/apify/toIsoDate";
import { isOriginalTweet } from "@/lib/apify/twitter/isOriginalTweet";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/** Tweet item from apidojo~twitter-scraper-lite (real shape, run ALVMZYXkh3WHgeGfT;
 * tweet fields verified on run bx3asRqfbNnkKgogG). */
type TweetItem = {
  isRetweet?: boolean;
  isQuote?: boolean;
  isReply?: boolean;
  url?: string;
  createdAt?: string;
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
 * Persists an X/Twitter profile scrape back to `socials` and the returned
 * tweets to `posts`/`social_posts` (chat#1840). The actor returns tweet
 * items; profile stats ride on `author`. The URL is lowercased —
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

  // Tweet URLs keep the author's display casing — the path segment is the
  // case-sensitive status id's context, and unlike profile keys they are
  // stored as-is (posts upsert keys on exact post_url).
  // Only the artist's own posts count — retweets are someone else's content
  // and stats, replies are conversation (chat#1855).
  const postRows: TablesInsert<"posts">[] = (items as TweetItem[]).flatMap(item =>
    item.url && isOriginalTweet(item)
      ? [{ post_url: item.url, updated_at: toIsoDate(item.createdAt) }]
      : [],
  );
  // Diff before persisting so the digest can report genuinely new posts (chat#1855).
  const newPostUrls = await filterNewPostUrls(postRows.map(p => p.post_url));
  const { posts } = await persistPostsForSocial({ postRows, profileUrl: social.profile_url });

  return { social, posts, newPostUrls };
}
