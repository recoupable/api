import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

type SocialFan = Tables<"social_fans">;
type Social = Tables<"socials">;
type PostComment = Tables<"post_comments">;

// Extended type to include joined data
export interface SocialFanWithDetails extends SocialFan {
  artist_social: Social;
  fan_social: Social;
  latest_engagement_comment: PostComment | null;
}

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
   * 1-indexed page. When both `page` and `limit` are provided, the query uses
   * `.range()` + `{ count: "exact" }` and `totalCount` is populated. Otherwise
   * all matching rows are returned and `totalCount` is `null`.
   */
  page?: number;
  limit?: number;
}

export interface SelectSocialFansResult {
  rows: SocialFanWithDetails[];
  totalCount: number | null;
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
 * `{ page, limit }`. When pagination is requested the query uses
 * `{ count: "exact" }` and the result includes `totalCount`; otherwise
 * `totalCount` is `null`.
 */
export const selectSocialFans = async (
  params?: SelectSocialFansParams,
): Promise<SelectSocialFansResult> => {
  const paginated = params?.page !== undefined && params?.limit !== undefined;

  let query = paginated
    ? supabase.from("social_fans").select(SOCIAL_FANS_SELECT, { count: "exact" })
    : supabase.from("social_fans").select(SOCIAL_FANS_SELECT);

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

  if (paginated) {
    const page = params!.page!;
    const limit = params!.limit!;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error selecting social fans:", error);
    throw error;
  }

  return {
    rows: (data || []) as SocialFanWithDetails[],
    totalCount: paginated ? (count ?? 0) : null,
  };
};
