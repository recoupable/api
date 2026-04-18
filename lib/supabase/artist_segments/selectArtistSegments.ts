import supabase from "@/lib/supabase/serverClient";

export interface SelectArtistSegmentsResponse {
  status: "success" | "error";
  segmentIds: string[];
}

/**
 * Gets all segment IDs associated with an artist account.
 *
 * @param artistAccountId - The artist account ID
 * @returns An object containing the status and the list of segment IDs
 */
export async function selectArtistSegments(
  artistAccountId: string,
): Promise<SelectArtistSegmentsResponse> {
  try {
    // Raise the default 1,000-row ceiling so large artists do not silently
    // drop segment ids before the downstream `selectFanSocialIds` fan-out.
    const { data, error } = await supabase
      .from("artist_segments")
      .select("segment_id")
      .eq("artist_account_id", artistAccountId)
      .limit(10000);

    if (error) {
      console.error("[ERROR] Error fetching artist_segments:", error);
      return {
        status: "error",
        segmentIds: [],
      };
    }

    return {
      status: "success",
      segmentIds: (data || []).map(row => row.segment_id),
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in selectArtistSegments:", error);
    return {
      status: "error",
      segmentIds: [],
    };
  }
}
