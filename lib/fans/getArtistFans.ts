import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans } from "@/lib/supabase/social_fans/selectSocialFans";
import { GetArtistFansParams } from "@/lib/fans/validateGetArtistFansRequest";

/**
 * Get paginated fans for an artist account, ordered by most recent engagement.
 */
export async function getArtistFans(params: GetArtistFansParams) {
  const { artistAccountId, page, limit } = params;

  const socialIds = await selectAccountSocialIds(artistAccountId);

  const { rows, totalCount } = await selectSocialFans({
    social_ids: socialIds,
    orderBy: "latest_engagement",
    orderDirection: "desc",
    page,
    limit,
  });

  const fans = rows
    .flatMap(row => row.fan_social)
    .filter(Boolean)
    .map(({ followerCount, followingCount, ...rest }) => ({
      ...rest,
      follower_count: followerCount,
      following_count: followingCount,
    }));

  return {
    status: "success" as const,
    fans,
    pagination: {
      total_count: totalCount,
      page,
      limit,
      total_pages: Math.ceil(totalCount / limit),
    },
  };
}
