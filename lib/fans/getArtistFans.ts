import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans } from "@/lib/supabase/social_fans/selectSocialFans";

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

/**
 * Retrieves paginated fans for an artist by composing two queries:
 *
 * 1. `selectAccountSocialIds` — resolves the artist account to the list of
 *    social IDs it owns (one account can connect multiple social profiles).
 * 2. `selectSocialFans` — joins `social_fans -> socials` via the
 *    `fan_social_id` FK, paginates in-database via `.range()`, and returns
 *    the total count via the Supabase `{ count: "exact" }` option. Rows are
 *    ordered by `latest_engagement` descending so the most recently-engaged
 *    fans appear first. When `social_ids` is an empty array the helper
 *    short-circuits to an empty envelope without hitting the DB.
 *
 * DB errors from either helper bubble up; the handler's outer try/catch owns
 * the 500 envelope shape.
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

  // PostgREST may infer `fan_social` as a single row, an array, or null
  // depending on the FK shape. Normalise all three into a flat list.
  const fans = rows
    .map((row) => row.fan_social)
    .filter(Boolean)
    .flatMap((f) => (Array.isArray(f) ? f.filter(Boolean) : f));

  return {
    status: "success" as const,
    fans,
    pagination: {
      total_count: totalCount,
      page,
      limit,
      total_pages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
    },
  };
}
