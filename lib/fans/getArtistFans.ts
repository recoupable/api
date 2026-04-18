import { callGetArtistFans, type ArtistFanProjection } from "@/lib/supabase/rpc/callGetArtistFans";

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
 * Retrieves paginated fans for an artist via the `get_artist_fans` Postgres
 * RPC, which performs the `artist_segments` → `fan_segments` → `socials` join,
 * applies DISTINCT on `socials.id`, orders stably, and paginates at the
 * database layer. This removes the implicit Supabase 10,000-row ceiling that
 * silently truncated the legacy in-memory composer for popular artists.
 *
 * @param params - The artist account ID and pagination options
 * @returns The fans envelope including pagination metadata
 */
export async function getArtistFans(params: GetArtistFansParams): Promise<GetArtistFansResponse> {
  const { artistAccountId, page, limit } = params;

  try {
    const offset = (page - 1) * limit;
    const { status, fans, totalCount } = await callGetArtistFans({
      artistAccountId,
      limit,
      offset,
    });

    if (status === "error") {
      return buildEmptyResponse("error", page, limit);
    }

    return {
      status,
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
