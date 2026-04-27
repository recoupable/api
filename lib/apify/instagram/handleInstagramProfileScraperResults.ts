import { getDataset } from "@/lib/apify/getDataset";
import { saveApifyInstagramPosts } from "@/lib/apify/instagram/saveApifyInstagramPosts";
import { handleInstagramProfileFollowUpRuns } from "@/lib/apify/instagram/handleInstagramProfileFollowUpRuns";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { insertSocials } from "@/lib/supabase/socials/insertSocials";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import {
  selectAccountSocials,
  type AccountSocialWithSocial,
} from "@/lib/supabase/account_socials/selectAccountSocials";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { uploadLinkToArweave } from "@/lib/arweave/uploadLinkToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";
import type { ApifyPayload } from "@/lib/apify/apifyPayloadSchema";
import type { Tables } from "@/types/database.types";

type ProfileScraperResult = {
  posts: Tables<"posts">[];
  social: Tables<"socials"> | null;
  accountSocials: AccountSocialWithSocial[];
  accountArtistIds: Awaited<ReturnType<typeof getAccountArtistIds>>;
  accountEmails: Tables<"account_emails">[];
  sentEmails: Awaited<ReturnType<typeof sendApifyWebhookEmail>>;
};

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
export async function handleInstagramProfileScraperResults(
  parsed: ApifyPayload,
): Promise<ProfileScraperResult> {
  const datasetId = parsed.resource.defaultDatasetId;
  const empty: ProfileScraperResult = {
    posts: [],
    social: null,
    accountSocials: [],
    accountArtistIds: [],
    accountEmails: [],
    sentEmails: null,
  };

  if (!datasetId) return empty;

  const dataset = await getDataset(datasetId);
  const firstResult = dataset[0] as ApifyInstagramProfileResult | undefined;
  if (!firstResult?.latestPosts) return empty;

  const { supabasePosts: posts } = await saveApifyInstagramPosts(firstResult.latestPosts);

  const arweaveTx = await uploadLinkToArweave(
    firstResult.profilePicUrlHD || firstResult.profilePicUrl,
  );
  if (arweaveTx) {
    firstResult.profilePicUrl = getFetchableUrl(`ar://${arweaveTx}`) ?? firstResult.profilePicUrl;
  }

  // Normalize once so the upsert and the subsequent lookup agree on the
  // `profile_url` key — otherwise the lookup misses and the rest of the
  // chain (social_posts link, email, follow-up scrape) is short-circuited.
  const normalizedUrl = normalizeProfileUrl(firstResult.url);

  await insertSocials([
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

  if (!social) {
    return { ...empty, posts };
  }

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

  const sentEmails = await sendApifyWebhookEmail(
    firstResult,
    accountEmails.map(e => e.email).filter(Boolean),
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
