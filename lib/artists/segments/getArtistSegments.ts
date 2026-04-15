import { selectArtistSegmentsCount } from "@/lib/supabase/artist_segments/selectArtistSegmentsCount";
import { selectArtistSegmentsWithDetails } from "@/lib/supabase/artist_segments/selectArtistSegmentsWithDetails";
import {
  mapArtistSegments,
  type MappedArtistSegment,
} from "@/lib/artists/segments/mapArtistSegments";
import type { ValidatedGetSegmentsQuery } from "@/lib/artists/segments/validateGetSegmentsQuery";

export interface GetArtistSegmentsResponse {
  status: "success" | "error";
  segments: MappedArtistSegment[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  message?: string;
}

/**
 * Fetches paginated segments for the given artist account.
 *
 * @param artistAccountId - Artist account ID from the route path
 * @param query - Validated pagination controls (`page`, `limit`)
 * @returns The paginated segments response envelope
 */
export const getArtistSegments = async (
  artistAccountId: string,
  { page, limit }: ValidatedGetSegmentsQuery,
): Promise<GetArtistSegmentsResponse> => {
  try {
    const offset = (page - 1) * limit;

    const total_count = await selectArtistSegmentsCount(artistAccountId);

    if (total_count === 0) {
      return {
        status: "success",
        segments: [],
        pagination: {
          total_count: 0,
          page,
          limit,
          total_pages: 0,
        },
      };
    }

    const data = await selectArtistSegmentsWithDetails(artistAccountId, offset, limit);

    if (!data) {
      return {
        status: "error",
        segments: [],
        pagination: {
          total_count,
          page,
          limit,
          total_pages: Math.ceil(total_count / limit),
        },
      };
    }

    const formattedSegments = mapArtistSegments(data);

    const total_pages = Math.ceil(total_count / limit);

    return {
      status: "success",
      segments: formattedSegments,
      pagination: {
        total_count,
        page,
        limit,
        total_pages,
      },
    };
  } catch (error) {
    console.error("[ERROR] Error in getArtistSegments:", error);
    throw error;
  }
};
