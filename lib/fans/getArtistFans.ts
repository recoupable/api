import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import { selectSocialFans, type SocialFanRow } from "@/lib/supabase/social_fans/selectSocialFans";

/**
 * Fan shape returned to callers — narrowed from the `fan_social` relation on
 * `social_fans` via `selectSocialFans`. The inferred type already matches the
 * 9 columns projected by the underlying `.select(...)` string.
 */
export type ArtistFan = NonNullable<
  SocialFanRow["fan_social"] extends Array<infer U> ? U : SocialFanRow["fan_social"]
>;

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

export interface GetArtistFansResponse {
  status: "success" | "error";
  fans: ArtistFan[];
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

    // PostgREST may infer `fan_social` as a single row, an array, or null
    // depending on the FK shape. Narrow both cases here.
    const fans: ArtistFan[] = [];
    for (const row of rows) {
      const fanSocial = row.fan_social;
      if (!fanSocial) continue;
      if (Array.isArray(fanSocial)) {
        for (const f of fanSocial) {
          if (f) fans.push(f as ArtistFan);
        }
      } else {
        fans.push(fanSocial as ArtistFan);
      }
    }

    return {
      status: "success",
      fans,
      pagination: {
        total_count: totalCount,
        page,
        limit,
        total_pages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in getArtistFans:", error);
    return buildEmptyResponse("error", page, limit);
  }
}
