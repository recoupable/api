import supabase from "@/lib/supabase/serverClient";

export interface SelectFanSocialIdsResponse {
  status: "success" | "error";
  socialIds: string[];
}

/**
 * Gets the deduplicated list of fan social IDs for the given segment IDs.
 *
 * @param segmentIds - Array of segment IDs to look up
 * @returns An object containing the status and the deduplicated list of fan social IDs
 */
export async function selectFanSocialIds(
  segmentIds: string[],
): Promise<SelectFanSocialIdsResponse> {
  try {
    if (!segmentIds.length) {
      return {
        status: "success",
        socialIds: [],
      };
    }

    // Supabase caps result sets at 1,000 rows by default. The pagination below
    // happens in memory over the full deduped id list, so a truncated result
    // would under-count `total_count` and hide later pages. Raise the ceiling
    // explicitly until a DB-side paginated variant replaces this flow.
    const { data, error } = await supabase
      .from("fan_segments")
      .select("fan_social_id")
      .in("segment_id", segmentIds)
      .limit(10000);

    if (error) {
      console.error("[ERROR] Error fetching fan_segments:", error);
      return {
        status: "error",
        socialIds: [],
      };
    }

    return {
      status: "success",
      socialIds: Array.from(new Set((data || []).map(row => row.fan_social_id))),
    };
  } catch (error) {
    console.error("[ERROR] Unexpected error in selectFanSocialIds:", error);
    return {
      status: "error",
      socialIds: [],
    };
  }
}
