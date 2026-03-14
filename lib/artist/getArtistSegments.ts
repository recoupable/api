import { selectArtistSegmentsCount } from "@/lib/supabase/artist_segments/selectArtistSegmentsCount";
import { selectArtistSegmentsWithDetails } from "@/lib/supabase/artist_segments/selectArtistSegmentsWithDetails";
import type { ArtistSegmentsQuery } from "@/lib/artist/validateArtistSegmentsQuery";
import { mapArtistSegments, type MappedArtistSegment } from "@/lib/artist/mapArtistSegments";

interface GetArtistSegmentsResponse {
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

export const getArtistSegments = async ({
  artist_account_id,
  page,
  limit,
}: ArtistSegmentsQuery): Promise<GetArtistSegmentsResponse> => {
  try {
    const offset = (page - 1) * limit;

    const total_count = await selectArtistSegmentsCount(artist_account_id);

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

    const data = await selectArtistSegmentsWithDetails(artist_account_id, offset, limit);

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
