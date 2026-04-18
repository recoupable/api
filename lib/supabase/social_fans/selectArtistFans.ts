import type { QueryData } from "@supabase/supabase-js";

import supabase from "../serverClient";

const ARTIST_FANS_SELECT = `fan_social:socials!social_fans_fan_social_id_fkey(
  id,
  username,
  avatar,
  profile_url,
  region,
  bio,
  followerCount,
  followingCount,
  updated_at
)` as const;

/**
 * Factory whose only job is to let `QueryData` infer the row shape returned by
 * the PostgREST foreign-table embed above. Not called at runtime — the actual
 * query in `selectArtistFans` adds `.in(...)`, `.order(...)`, `.range(...)`,
 * and `{ count: "exact" }`, none of which change the row type.
 */
const _buildArtistFansQuery = () => supabase.from("social_fans").select(ARTIST_FANS_SELECT);

type ArtistFanRow = QueryData<ReturnType<typeof _buildArtistFansQuery>>[number];

/**
 * Fan projection returned to callers. Extracted from the embedded `fan_social`
 * relation, which PostgREST types as `T | T[] | null` depending on the FK
 * cardinality it can infer — here it's a to-one join, so we narrow to the
 * single-row variant after dropping nulls.
 */
export type ArtistFanProjection = NonNullable<
  ArtistFanRow["fan_social"] extends Array<infer U> ? U : ArtistFanRow["fan_social"]
>;

export interface SelectArtistFansParams {
  artistSocialIds: string[];
  from: number;
  to: number;
}

export interface SelectArtistFansResponse {
  status: "success" | "error";
  fans: ArtistFanProjection[];
  totalCount: number;
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
export async function selectArtistFans(
  params: SelectArtistFansParams,
): Promise<SelectArtistFansResponse> {
  const { artistSocialIds, from, to } = params;

  if (artistSocialIds.length === 0) {
    return { status: "success", fans: [], totalCount: 0 };
  }

  const { data, error, count } = await supabase
    .from("social_fans")
    .select(ARTIST_FANS_SELECT, { count: "exact" })
    .in("artist_social_id", artistSocialIds)
    .order("latest_engagement", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error("[ERROR] Error selecting artist fans page:", error);
    return { status: "error", fans: [], totalCount: 0 };
  }

  const rows: ArtistFanRow[] = data ?? [];
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
