import supabase from "../serverClient";

export interface ArtistFanProjection {
  id: string;
  username: string | null;
  avatar: string | null;
  profile_url: string | null;
  region: string | null;
  bio: string | null;
  followerCount: number | null;
  followingCount: number | null;
  updated_at: string | null;
}

export interface SelectArtistFansPageParams {
  artistSocialIds: string[];
  from: number;
  to: number;
}

export interface SelectArtistFansPageResponse {
  status: "success" | "error";
  fans: ArtistFanProjection[];
  totalCount: number;
}

interface SocialFansRow {
  fan_social: ArtistFanProjection | ArtistFanProjection[] | null;
}

/**
 * Returns a paginated page of fans (unique fan `socials`) for a given set of
 * artist social IDs by joining `social_fans -> socials` via the
 * `social_fans_fan_social_id_fkey` foreign key. Ordered by `latest_engagement`
 * descending (nulls last) so the most recently-engaged fans appear first.
 *
 * Short-circuits to an empty successful response when `artistSocialIds` is
 * empty to avoid issuing an unnecessary query.
 */
export async function selectArtistFansPage(
  params: SelectArtistFansPageParams,
): Promise<SelectArtistFansPageResponse> {
  const { artistSocialIds, from, to } = params;

  if (artistSocialIds.length === 0) {
    return { status: "success", fans: [], totalCount: 0 };
  }

  const { data, error, count } = await supabase
    .from("social_fans")
    .select(
      `fan_social:socials!social_fans_fan_social_id_fkey(
        id,
        username,
        avatar,
        profile_url,
        region,
        bio,
        followerCount,
        followingCount,
        updated_at
      )`,
      { count: "exact" },
    )
    .in("artist_social_id", artistSocialIds)
    .order("latest_engagement", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error("[ERROR] Error selecting artist fans page:", error);
    return { status: "error", fans: [], totalCount: 0 };
  }

  const rows = (data ?? []) as SocialFansRow[];
  const fans: ArtistFanProjection[] = [];
  for (const row of rows) {
    const fan = Array.isArray(row.fan_social) ? row.fan_social[0] : row.fan_social;
    if (fan) {
      fans.push(fan);
    }
  }

  return {
    status: "success",
    fans,
    totalCount: count ?? 0,
  };
}
