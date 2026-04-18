import { selectAccountSocialIds } from "@/lib/supabase/account_socials/selectAccountSocialIds";
import {
  selectArtistFansPage,
  type ArtistFanProjection,
} from "@/lib/supabase/social_fans/selectArtistFansPage";

export type { ArtistFanProjection };

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

/**
 * Retrieves paginated fans for an artist by composing two queries:
 *
 * 1. `selectAccountSocialIds` — resolves the artist account to the list of
 *    social IDs it owns (one account can connect multiple social profiles).
 * 2. `selectArtistFansPage` — joins `social_fans -> socials` via the
 *    `fan_social_id` FK, paginates in-database via `.range(from, to)`, and
 *    returns the total count via the Supabase `{ count: "exact" }` option.
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

    const offset = (page - 1) * limit;
    const from = offset;
    const to = offset + limit - 1;

    const {
      status: fansStatus,
      fans,
      totalCount,
    } = await selectArtistFansPage({
      artistSocialIds: socialIds,
      from,
      to,
    });

    if (fansStatus === "error") {
      return buildEmptyResponse("error", page, limit);
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
