import supabase from "../serverClient";

// Allowed top-level columns for ordering
const SOCIAL_FANS_ORDERABLE_COLUMNS = [
  "id",
  "artist_social_id",
  "fan_social_id",
  "created_at",
  "updated_at",
  "latest_engagement",
  "latest_engagement_id",
] as const;
type SocialFansOrderableColumn = (typeof SOCIAL_FANS_ORDERABLE_COLUMNS)[number];

export interface SelectSocialFansParams {
  social_ids?: string[];
  orderBy?: SocialFansOrderableColumn;
  orderDirection?: "asc" | "desc";
  /**
   * 1-indexed page. When both `page` and `limit` are provided, the query is
   * paginated via `.range()`. `totalCount` is always returned as a number
   * regardless, because `{ count: "exact" }` is used unconditionally.
   */
  page?: number;
  limit?: number;
}

const SOCIAL_FANS_SELECT = `
      *,
      artist_social:socials!social_fans_artist_social_id_fkey(
        id,
        username,
        bio,
        followerCount,
        followingCount,
        avatar,
        profile_url,
        region,
        updated_at
      ),
      fan_social:socials!social_fans_fan_social_id_fkey(
        id,
        username,
        bio,
        followerCount,
        followingCount,
        avatar,
        profile_url,
        region,
        updated_at
      ),
      latest_engagement_comment:post_comments!social_fans_latest_engagement_id_fkey(
        id,
        comment,
        commented_at,
        post_id,
        social_id
      )
    ` as const;

/**
 * Canonical helper for selecting `social_fans` rows with their joined
 * `artist_social`, `fan_social`, and `latest_engagement_comment` relations.
 *
 * Supports optional filtering by `artist_social_id` (`social_ids`), ordering
 * on a whitelisted set of top-level columns, and optional pagination via
 * `{ page, limit }`. `totalCount` is always returned as a number (exact
 * count, regardless of whether pagination was requested).
 *
 * Row type is inferred from the Supabase schema + the `.select(...)` string,
 * so callers get precise typing for free. Use `SocialFanRow` to name it.
 */
export const selectSocialFans = async (params?: SelectSocialFansParams) => {
  // Short-circuit: caller passed an explicit empty `social_ids` filter, so the
  // query would match zero rows by construction. Skip the DB round-trip.
  if (params?.social_ids !== undefined && params.social_ids.length === 0) {
    return { rows: [], totalCount: 0 };
  }

  let query = supabase.from("social_fans").select(SOCIAL_FANS_SELECT, { count: "exact" });

  if (params?.social_ids && params.social_ids.length > 0) {
    query = query.in("artist_social_id", params.social_ids);
  }

  // Only allow ordering by top-level columns
  if (params?.orderBy && SOCIAL_FANS_ORDERABLE_COLUMNS.includes(params.orderBy)) {
    query = query.order(params.orderBy, {
      ascending: params.orderDirection !== "desc",
      nullsFirst: false,
    });
  }

  if (params?.page !== undefined && params?.limit !== undefined) {
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error selecting social fans:", error);
    throw error;
  }

  return {
    rows: data ?? [],
    totalCount: count ?? 0,
  };
};

/**
 * Row shape returned by `selectSocialFans`, inferred from the Supabase
 * schema and the joined `.select(...)` projection.
 */
export type SocialFanRow = Awaited<ReturnType<typeof selectSocialFans>>["rows"][number];
