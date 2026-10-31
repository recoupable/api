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

  const fans = rows.flatMap(row => {
    const comments = [row.latest_engagement_comment].flat().filter(Boolean);
    return [row.fan_social]
      .flat()
      .filter(Boolean)
      .map(({ followerCount, followingCount, ...rest }) => ({
        ...rest,
        follower_count: followerCount,
        following_count: followingCount,
        // A profile refresh or unrelated engagement timestamp is not a comment date.
        last_comment_at:
          comments.find(comment => comment.social_id === rest.id)?.commented_at ?? null,
      }));
  });

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
