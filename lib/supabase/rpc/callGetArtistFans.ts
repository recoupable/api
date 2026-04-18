import supabase from "@/lib/supabase/serverClient";

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

export interface CallGetArtistFansParams {
  artistAccountId: string;
  limit: number;
  offset: number;
}

export interface CallGetArtistFansResponse {
  status: "success" | "error";
  fans: ArtistFanProjection[];
  totalCount: number;
}

interface GetArtistFansRow extends ArtistFanProjection {
  total_count: number | string;
}

/**
 * Calls the `get_artist_fans` Postgres RPC, which joins `artist_segments` →
 * `fan_segments` → `socials`, applies DISTINCT on `socials.id`, and paginates
 * in-database so the Supabase 10,000-row response ceiling never truncates.
 *
 * `total_count` is repeated on every row (via `COUNT(*) OVER()`); we read it
 * from the first row and strip it from the fan projection.
 */
export async function callGetArtistFans(
  params: CallGetArtistFansParams,
): Promise<CallGetArtistFansResponse> {
  const { artistAccountId, limit, offset } = params;

  try {
    const { data, error } = await supabase.rpc("get_artist_fans", {
      artist_account_id: artistAccountId,
      limit_count: limit,
      offset_count: offset,
    });

    if (error) {
      console.error("[ERROR] Error calling get_artist_fans RPC:", error);
      return {
        status: "error",
        fans: [],
        totalCount: 0,
      };
    }

    const rows = (data ?? []) as GetArtistFansRow[];

    if (rows.length === 0) {
      return {
        status: "success",
        fans: [],
        totalCount: 0,
      };
    }

    const totalCount = Number(rows[0].total_count) || 0;
    const fans: ArtistFanProjection[] = rows.map(row => ({
      id: row.id,
      username: row.username,
      avatar: row.avatar,
      profile_url: row.profile_url,
      region: row.region,
      bio: row.bio,
      followerCount: row.followerCount,
      followingCount: row.followingCount,
      updated_at: row.updated_at,
    }));

    return {
      status: "success",
      fans,
      totalCount,
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in callGetArtistFans:", error);
    return {
      status: "error",
      fans: [],
      totalCount: 0,
    };
  }
}
