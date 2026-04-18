import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans } from "@/lib/supabase/social_fans/selectSocialFans";
import type { Tables } from "@/types/database.types";

/**
 * Fan projection returned to callers — the 9 fields of `socials` that the
 * public envelope exposes. Extracted from the `fan_social` join on
 * `social_fans` via `selectSocialFans`.
 */
export type ArtistFanProjection = Pick<
  Tables<"socials">,
  | "id"
  | "username"
  | "avatar"
  | "profile_url"
  | "region"
  | "bio"
  | "followerCount"
  | "followingCount"
  | "updated_at"
>;

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

export interface GetArtistFansResponse {
  status: "success" | "error";
  fans: ArtistFanProjection[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

function buildEmptyResponse(
  status: "success" | "error",
  page: number,
  limit: number,
  totalCount: number = 0,
): GetArtistFansResponse {
  return {
    status,
    fans: [],
    pagination: {
      total_count: totalCount,
      page,
      limit,
      total_pages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
    },
  };
}

function projectFan(fanSocial: Tables<"socials">): ArtistFanProjection {
  return {
    id: fanSocial.id,
    username: fanSocial.username,
    avatar: fanSocial.avatar,
    profile_url: fanSocial.profile_url,
    region: fanSocial.region,
    bio: fanSocial.bio,
    followerCount: fanSocial.followerCount,
    followingCount: fanSocial.followingCount,
    updated_at: fanSocial.updated_at,
  };
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
 *    fans appear first.
 *
 * Replaces the previous `get_artist_fans` RPC that joined the now-removed
 * `artist_segments`/`fan_segments` tables. The direct artist→fans relationship
 * now lives in `social_fans` (auto-populated by a `post_comments` trigger).
 */
export async function getArtistFans(params: GetArtistFansParams): Promise<GetArtistFansResponse> {
  const { artistAccountId, page, limit } = params;

  try {
    const { status: accountStatus, socialIds } = await selectAccountSocialIds(artistAccountId);

    if (accountStatus === "error") {
      return buildEmptyResponse("error", page, limit);
    }

    if (socialIds.length === 0) {
      return buildEmptyResponse("success", page, limit);
    }

    const { rows, totalCount } = await selectSocialFans({
      social_ids: socialIds,
      orderBy: "latest_engagement",
      orderDirection: "desc",
      page,
      limit,
    });

    const fans: ArtistFanProjection[] = [];
    for (const row of rows) {
      if (row.fan_social) {
        fans.push(projectFan(row.fan_social));
      }
    }

    const total = totalCount ?? 0;

    return {
      status: "success",
      fans,
      pagination: {
        total_count: total,
        page,
        limit,
        total_pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in getArtistFans:", error);
    return buildEmptyResponse("error", page, limit);
  }
}
