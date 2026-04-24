import { getDataset } from "@/lib/apify/getDataset";
import { saveApifyInstagramPosts } from "@/lib/apify/instagram/saveApifyInstagramPosts";
import { handleInstagramProfileFollowUpRuns } from "@/lib/apify/instagram/handleInstagramProfileFollowUpRuns";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { insertSocials } from "@/lib/supabase/socials/insertSocials";
import { selectSocialByProfileUrl } from "@/lib/supabase/socials/selectSocialByProfileUrl";
import { insertSocialPosts } from "@/lib/supabase/social_posts/insertSocialPosts";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import type { ApifyInstagramPost, ApifyInstagramProfileResult } from "@/lib/apify/types";
import type { ApifyPayload } from "@/lib/apify/apifyPayloadSchema";

/**
 * Handles Instagram profile scraper Apify webhook results:
 *  - Persists the returned posts + social profile row.
 *  - Mirrors the profile pic to Arweave.
 *  - Notifies subscribed account emails via Resend.
 *  - Queues the comments scraper for the profile's latest posts.
 *
 * Returns a summary object for logging / downstream inspection. All
 * failures inside the chain are logged but allowed to propagate to the
 * webhook route's outer try/catch, which always returns 200.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleInstagramProfileScraperResults(parsed: ApifyPayload) {
  const datasetId = parsed.resource.defaultDatasetId;
  const empty = {
    posts: [],
    social: null,
    accountSocials: [] as unknown[],
    accountArtistIds: [] as unknown[],
    accountEmails: [] as unknown[],
    sentEmails: null as unknown,
  };

  if (!datasetId) return empty;

  const dataset = await getDataset(datasetId);
  const firstResult = dataset[0] as ApifyInstagramProfileResult | undefined;
  if (!firstResult?.latestPosts) return empty;

  const { supabasePosts: posts } = await saveApifyInstagramPosts(
    firstResult.latestPosts as ApifyInstagramPost[],
  );

  const arweaveTx = await uploadLinkToArweave(
    firstResult.profilePicUrlHD || firstResult.profilePicUrl,
  );
  if (arweaveTx) {
    firstResult.profilePicUrl = getFetchableUrl(`ar://${arweaveTx}`) ?? firstResult.profilePicUrl;
  }

  await insertSocials([
    {
      username: firstResult.username ?? "",
      avatar: firstResult.profilePicUrl ?? null,
      profile_url: firstResult.url ?? "",
      bio: firstResult.biography ?? null,
      followerCount: firstResult.followersCount ?? null,
      followingCount: firstResult.followsCount ?? null,
    },
  ]);

  const normalizedUrl = normalizeProfileUrl(firstResult.url);
  const social = await selectSocialByProfileUrl(normalizedUrl);

  if (!social) {
    return { ...empty, posts };
  }

  if (posts.length) {
    await insertSocialPosts(
      posts.map(post => ({
        post_id: post.id,
        updated_at: post.updated_at,
        social_id: social.id,
      })),
    );
  }

  const accountSocials = await selectAccountSocials({ socialId: social.id, limit: 10000 });
  const accountArtistIds = await getAccountArtistIds({
    artistIds: accountSocials.map(a => a.account_id as string),
  });

  const uniqueAccountIds = Array.from(
    new Set(
      accountArtistIds
        .map(a => (a as unknown as { account_id: string | null }).account_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const accountEmails = await selectAccountEmails({ accountIds: uniqueAccountIds });

  const sentEmails = await sendApifyWebhookEmail(
    firstResult as unknown as Record<string, unknown>,
    accountEmails.map(e => e.email).filter(Boolean) as string[],
  );

  await handleInstagramProfileFollowUpRuns(dataset, firstResult);

  return {
    posts,
    social,
    accountSocials,
    accountArtistIds,
    accountEmails,
    sentEmails,
  };
}
