import type { SegmentQueryResult } from "@/lib/supabase/artist_segments/selectArtistSegmentsWithDetails";

export interface MappedArtistSegment {
  id: string;
  artist_account_id: string;
  segment_id: string;
  updated_at: string;
  segment_name: string;
  artist_name: string;
}

/**
 * Maps Supabase query results into the expected artist segment response format.
 *
 * @param segments - The raw query results from Supabase with joined segment and account data
 * @returns Array of mapped artist segments
 */
export function mapArtistSegments(segments: SegmentQueryResult[]): MappedArtistSegment[] {
  return segments.map(segment => {
    const { segments, accounts } = segment;

    return {
      id: segment.id,
      artist_account_id: segment.artist_account_id,
      segment_id: segment.segment_id,
      updated_at: segment.updated_at || "",
      segment_name: segments?.name || "Unknown Segment",
      artist_name: accounts?.name || "Unknown Artist",
    };
  });
}
