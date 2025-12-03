import { selectArtistSegmentsCount } from "@/lib/supabase/artist_segments/selectArtistSegmentsCount";
import { selectArtistSegments } from "@/lib/supabase/artist_segments/selectArtistSegments";
import type { ArtistSegmentsQuery } from "@/lib/artist/validateArtistSegmentsQuery";

interface GetArtistSegmentsResponse {
  status: "success" | "error";
  segments: {
    id: string;
    artist_account_id: string;
    segment_id: string;
    updated_at: string;
    segment_name: string;
    artist_name: string;
  }[];
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
    // Validate limit is between 1 and 100
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (page - 1) * validatedLimit;

    // Get total count first
    const total_count = await selectArtistSegmentsCount(artist_account_id);

    if (total_count === 0) {
      return {
        status: "success",
        segments: [],
        pagination: {
          total_count: 0,
          page,
          limit: validatedLimit,
          total_pages: 0,
        },
      };
    }

    // Get paginated segments with joins
    const data = await selectArtistSegments(artist_account_id, offset, validatedLimit);

    if (!data) {
      return {
        status: "success",
        segments: [],
        pagination: {
          total_count: 0,
          page,
          limit: validatedLimit,
          total_pages: 0,
        },
      };
    }

    const formattedSegments = data.map(segment => ({
      id: segment.id,
      artist_account_id: segment.artist_account_id,
      segment_id: segment.segment_id,
      updated_at: segment.updated_at || new Date().toISOString(),
      segment_name: segment.segments?.name || "Unknown Segment",
      artist_name: segment.accounts?.name || "Unknown Artist",
    }));

    const total_pages = Math.ceil(total_count / validatedLimit);

    return {
      status: "success",
      segments: formattedSegments,
      pagination: {
        total_count,
        page,
        limit: validatedLimit,
        total_pages,
      },
    };
  } catch (error) {
    console.error("[ERROR] Error in getArtistSegments:", error);
    throw error;
  }
};
