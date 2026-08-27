import apifyClient from "@/lib/apify/client";
import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { handleInstagramProfileFollowUpRuns } from "@/lib/apify/instagram/handleInstagramProfileFollowUpRuns";
import { mapInstagramProfileToSocial } from "@/lib/apify/instagram/mapInstagramProfileToSocial";
import { mapInstagramPostsToRows } from "@/lib/apify/instagram/mapInstagramPostsToRows";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/**
 * Handles Instagram profile scraper webhook results (app#2018):
 *  - Every profile in the dataset is upserted to `socials` with avatar,
 *    bio, follower/following counts, plus a follower snapshot — this is
 *    how a commenter batch (`origin: "fan"`) enriches every fan, not
 *    just `dataset[0]`.
 *  - Only an `origin: "artist"` run continues: Arweave-mirrored avatar,
 *    posts with engagement, `social_posts` links, and — only when the
 *    profile is linked to an account — the comments follow-up run.
 *  - A fan batch, or a legacy payload with no `origin`, stops after the
 *    socials upsert. Fan discovery is one hop deep by construction; the
 *    old `dataset.length === 1` heuristic is gone.
 *
 * Failures propagate to the webhook route's outer try/catch, which logs
 * and returns an error response (always HTTP 200 to Apify).
 */
export async function handleInstagramProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const profiles = (items as ApifyInstagramProfileResult[]).filter(p => p?.url);
  if (profiles.length === 0) return { posts: [], social: null };

  const isArtistRun = parsed.origin === "artist";
  const [firstResult] = profiles;

  // Artists get their avatar mirrored to Arweave; fans keep the CDN URL —
  // one upload per commenter batch would be cost without product.
  let artistAvatar: string | null | undefined;
  if (isArtistRun) {
    const arweaveTx = await uploadLinkToArweave(
      firstResult.profilePicUrlHD || firstResult.profilePicUrl,
    );
    if (arweaveTx) artistAvatar = getFetchableUrl(`ar://${arweaveTx}`) ?? firstResult.profilePicUrl;
  }

  const upserted = await upsertSocialsWithSnapshot(
    profiles.map((p, i) => mapInstagramProfileToSocial(p, i === 0 ? artistAvatar : undefined)),
  );
  if (!isArtistRun) return { posts: [], social: null, socials: profiles.length };

  const postRows = mapInstagramPostsToRows(firstResult.latestPosts);
  // Diff BEFORE upserting — afterwards every scraped post exists and nothing
  // is distinguishable as new (chat#1855).
  const newPostUrls = await filterNewPostUrls(postRows.map(p => p.post_url));
  if (postRows.length > 0) await upsertPosts(postRows);
  const posts =
    postRows.length > 0 ? await getPosts({ postUrls: postRows.map(p => p.post_url) }) : [];

  const profileUrl = mapInstagramProfileToSocial(firstResult).profile_url;
  const socialRow = upserted.find(s => s.profile_url === profileUrl) ?? null;
  if (!socialRow) return { posts, social: null, newPostUrls };

  if (posts.length) {
    await upsertSocialPosts(
      posts.map(post => ({
        post_id: post.id,
        updated_at: post.updated_at,
        social_id: socialRow.id,
      })),
    );
  }

  // Follow-ups only for a profile some account actually owns: an artist
  // run for an unlinked profile persists, but spawns nothing.
  const accountSocials = await selectAccountSocials({ socialId: socialRow.id, limit: 10000 });
  if (accountSocials.length > 0) {
    try {
      await handleInstagramProfileFollowUpRuns(firstResult, {
        origin: "artist",
        parentRunId: parsed.resource.id,
      });
    } catch (error) {
      console.error("[WARN] follow-up scrape failed:", error);
    }
  }

  return { posts, social: socialRow, accountSocials, newPostUrls };
}
