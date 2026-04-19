import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans } from "@/lib/supabase/social_fans/selectSocialFans";

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

/**
 * Paginated fans for an artist account, ordered by most recent engagement.
 *
 * Fans come from `social_fans`, which is trigger-populated from `post_comments`.
 * An artist account may own several social profiles; fans are aggregated across
 * all of them. Pagination and total count both happen in the DB.
 *
 * DB errors bubble; the handler owns the 500 envelope.
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

  const fans = rows.flatMap(row => row.fan_social).filter(Boolean);

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
