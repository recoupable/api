import supabase from "../serverClient";

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
  page?: number;
  limit?: number;
}

export const selectSocialFans = async (params?: SelectSocialFansParams) => {
  if (params?.social_ids !== undefined && params.social_ids.length === 0) {
    return { rows: [], totalCount: 0 };
  }

  let query = supabase.from("social_fans").select(
    `
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
    `,
    { count: "exact" },
  );

  if (params?.social_ids && params.social_ids.length > 0) {
    query = query.in("artist_social_id", params.social_ids);
  }

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
