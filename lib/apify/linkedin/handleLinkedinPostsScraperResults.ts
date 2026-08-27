import apifyClient from "@/lib/apify/client";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { persistPostsForSocial } from "@/lib/apify/persistPostsForSocial";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { toIsoDate } from "@/lib/apify/toIsoDate";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/** Post item from harvestapi~linkedin-profile-posts (real shape, 2026-08-25 run). */
type LinkedinPostItem = {
  linkedinUrl?: string;
  postedAt?: { date?: string };
  engagement?: { likes?: number; comments?: number; shares?: number };
  author?: {
    publicIdentifier?: string;
    linkedinUrl?: string;
    info?: string;
    avatar?: { url?: string };
  };
};

/**
 * Persists a LinkedIn posts scrape — the actor `startLinkedinProfileScraping`
 * runs when a `posts` depth is requested (app#2018; its id was not in the
 * handler registry before, so these runs persisted nothing). The author
 * rides on every item without a follower count, so the socials upsert
 * refreshes avatar/headline only and writes no snapshot; the profile actor
 * (a scrape without `posts`) is the follower-count path.
 *
 * The author URL carries a `?miniProfileUrn=` query; it is stripped so the
 * upsert hits the stored `linkedin.com/in/<slug>` row.
 */
export async function handleLinkedinPostsScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const author = (items[0] as LinkedinPostItem | undefined)?.author;
  if (!author?.linkedinUrl) return { social: null };

  const social = {
    profile_url: normalizeProfileUrl(author.linkedinUrl.split("?")[0]),
    username: author.publicIdentifier,
    avatar: author.avatar?.url ?? null,
    bio: author.info || null,
  };
  await upsertSocialsWithSnapshot([social]);

  const postRows: TablesInsert<"posts">[] = (items as LinkedinPostItem[]).flatMap(item =>
    item.linkedinUrl
      ? [
          {
            post_url: item.linkedinUrl,
            updated_at: toIsoDate(item.postedAt?.date),
            likes: item.engagement?.likes ?? null,
            comments: item.engagement?.comments ?? null,
            reposts: item.engagement?.shares ?? null,
          },
        ]
      : [],
  );
  const newPostUrls = await filterNewPostUrls(postRows.map(p => p.post_url));
  const { posts } = await persistPostsForSocial({ postRows, profileUrl: social.profile_url });

  return { social, posts, newPostUrls };
}
