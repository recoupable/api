import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans } from "@/lib/supabase/social_fans/selectSocialFans";

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

/**
 * Get paginated fans for an artist account, ordered by most recent engagement.
 *
 * Fans are sourced from `social_fans`, a trigger-populated table driven by
 * `post_comments`. Since one artist account may own several social profiles,
 * fans are aggregated across all of them. Pagination and total count both
 * happen at the database layer.
 *
 * @param params - Artist account ID and pagination controls
 * @param params.artistAccountId - Account ID of the artist whose fans to fetch
 * @param params.page - 1-indexed page number
 * @param params.limit - Page size (max enforced by the validator)
 * @returns Paginated fans envelope with `fans`, `pagination`, and `status: "success"`
 * @throws If either underlying Supabase query fails — the handler's outer
 *         try/catch owns the 500 envelope shape
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
