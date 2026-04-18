import { selectArtistSegments } from "@/lib/supabase/artist_segments/selectArtistSegments";
import { selectFanSocialIds } from "@/lib/supabase/fan_segments/selectFanSocialIds";
import {
  selectSocialsByIds,
  type SocialByIdProjection,
} from "@/lib/supabase/socials/selectSocialsByIds";

export interface GetArtistFansParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

export interface GetArtistFansResponse {
  status: "success" | "error";
  fans: SocialByIdProjection[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Builds an error/empty response envelope for the given status and pagination context.
 */
function buildEmptyResponse(
  status: "success" | "error",
  page: number,
  limit: number,
): GetArtistFansResponse {
  return {
    status,
    fans: [],
    pagination: {
      total_count: 0,
      page,
      limit,
      total_pages: 0,
    },
  };
}

/**
 * Retrieves paginated fans for an artist by composing `artist_segments` → `fan_segments` → `socials`.
 *
 * TODO: This mirrors the legacy Express route and fetches every deduplicated
 * `fan_social_id` before slicing in memory. For artists with many fans this
 * returns thousands of IDs before paginating — replace with a DB-side paginated
 * query once the legacy envelope can diverge. See
 * `Recoup-Agent-APIs/lib/supabase/getArtistFans.ts:48-64` for the original behavior.
 *
 * @param params - The artist account ID and pagination options
 * @returns The fans envelope including pagination metadata
 */
export async function getArtistFans(params: GetArtistFansParams): Promise<GetArtistFansResponse> {
  const { artistAccountId, page, limit } = params;

  try {
    const { status: segmentsStatus, segmentIds } = await selectArtistSegments(artistAccountId);
    if (segmentsStatus === "error") {
      return buildEmptyResponse("error", page, limit);
    }
    if (!segmentIds.length) {
      return buildEmptyResponse("success", page, limit);
    }

    const { status: fanIdsStatus, socialIds } = await selectFanSocialIds(segmentIds);
    if (fanIdsStatus === "error") {
      return buildEmptyResponse("error", page, limit);
    }
    if (!socialIds.length) {
      return buildEmptyResponse("success", page, limit);
    }

    const total = socialIds.length;
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const pagedIds = socialIds.slice(startIndex, endIndex);

    const { status: socialsStatus, socials } = await selectSocialsByIds(pagedIds);
    if (socialsStatus === "error") {
      return buildEmptyResponse("error", page, limit);
    }

    return {
      status: socialsStatus,
      fans: socials,
      pagination: {
        total_count: total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in getArtistFans:", error);
    return buildEmptyResponse("error", page, limit);
  }
}
