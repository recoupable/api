import supabase from "../serverClient";
import { Tables } from "@/types/database.types";
import { selectArtistSegments } from "../artist_segments/selectArtistSegments";

/**
 * Deletes all segments associated with an artist account.
 *
 * @param artist_account_id - The artist account ID
 * @returns Array of deleted segments
 */
export const deleteSegments = async (artist_account_id: string): Promise<Tables<"segments">[]> => {
  // Get all segment_ids associated with the artist
  const artistSegments = await selectArtistSegments(artist_account_id);
  const segmentIds = artistSegments.map((item: { segment_id: string }) => item.segment_id);

  if (segmentIds.length === 0) {
    // No segments to delete
    return [];
  }

  // Delete the segments from the segments table
  const { data, error } = await supabase.from("segments").delete().in("id", segmentIds).select();

  if (error) {
    console.error("Error deleting segments:", error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn(`No segments found with ids: ${segmentIds.join(", ")}`);
    return [];
  }

  return data;
};
