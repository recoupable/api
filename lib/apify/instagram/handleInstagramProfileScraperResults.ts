import apifyClient from "@/lib/apify/client";
import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { handleInstagramProfileFollowUpRuns } from "@/lib/apify/instagram/handleInstagramProfileFollowUpRuns";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { fetchRemoteImageBuffer } from "@/lib/networking/fetchRemoteImageBuffer";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { TablesInsert } from "@/types/database.types";

/**
 * Handles Instagram profile scraper Apify webhook results:
 *  - Persists the returned posts + social profile row.
 *  - Mirrors the profile pic to the public-uploads Supabase bucket.
 *  - Notifies subscribed account emails via Resend.
 *  - Queues the comments scraper for the profile's latest posts.
 *
 * Returns a summary object for downstream inspection. Failures
 * propagate to the webhook route's outer try/catch, which logs and
 * returns an error response (always HTTP 200 to Apify).
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleInstagramProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items: dataset } = await apifyClient
    .dataset(parsed.resource.defaultDatasetId)
    .listItems();
  const firstResult = dataset[0] as ApifyInstagramProfileResult | undefined;
  if (!firstResult?.latestPosts) return { posts: [], social: null };

  const postRows: TablesInsert<"posts">[] = firstResult.latestPosts.flatMap(post =>
    post.url ? [{ post_url: post.url, updated_at: post.timestamp }] : [],
  );
  if (postRows.length === 0) return { posts: [], social: null };
  await upsertPosts(postRows);
  const posts = await getPosts({ postUrls: postRows.map(p => p.post_url) });

  // Mirror the profile pic to durable storage so we don't lose it when
  // Instagram's CDN rotates / expires the original URL. Fall back to the
  // original on any failure.
  const fetched = await fetchRemoteImageBuffer(
    firstResult.profilePicUrlHD || firstResult.profilePicUrl,
  );
  if (fetched) {
    try {
      const { url } = await uploadDataToPublicBucket({
        data: fetched.buffer,
        contentType: fetched.contentType,
      });
      firstResult.profilePicUrl = url;
    } catch (err) {
      console.error("[ERROR] uploading profile pic to public bucket:", err);
    }
  }

  // Normalize once so the upsert and the subsequent lookup agree on the
  // `profile_url` key — otherwise the lookup misses and the rest of the
  // chain (social_posts link, email, follow-up scrape) is short-circuited.
  const normalizedUrl = normalizeProfileUrl(firstResult.url);

  await upsertSocials([
    {
      username: firstResult.username ?? "",
      avatar: firstResult.profilePicUrl ?? null,
      profile_url: normalizedUrl,
      bio: firstResult.biography ?? null,
      followerCount: firstResult.followersCount ?? null,
      followingCount: firstResult.followsCount ?? null,
    },
  ]);

  const matches = await selectSocials({ profile_url: normalizedUrl });
  const social = matches?.[0] ?? null;

  if (!social) return { posts, social: null };

  if (posts.length) {
    await upsertSocialPosts(
      posts.map(post => ({
        post_id: post.id,
        updated_at: post.updated_at,
        social_id: social.id,
      })),
    );
  }

  const accountSocials = await selectAccountSocials({ socialId: social.id, limit: 10000 });
  const accountArtistIds = await getAccountArtistIds({
    artistIds: accountSocials.map(a => a.account_id),
  });

  const uniqueAccountIds = Array.from(
    new Set(accountArtistIds.map(a => a.account_id).filter((id): id is string => Boolean(id))),
  );

  const accountEmails = await selectAccountEmails({ accountIds: uniqueAccountIds });

  // Email + follow-up scrape are independent side effects; isolate so a
  // mail outage doesn't block comment scraping and vice versa.
  let sentEmails = null;
  try {
    sentEmails = await sendApifyWebhookEmail(
      firstResult,
      accountEmails.map(e => e.email).filter(Boolean),
    );
  } catch (error) {
    console.error("[WARN] webhook email failed:", error);
  }

  try {
    await handleInstagramProfileFollowUpRuns(dataset, firstResult);
  } catch (error) {
    console.error("[WARN] follow-up scrape failed:", error);
  }

  return { posts, social, accountSocials, accountEmails, sentEmails };
}
