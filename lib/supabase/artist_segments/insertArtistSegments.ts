import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts artist_segments associations into the database.
 *
 * @param artistSegments - Array of artist_segment objects to insert
 * @returns Array of inserted artist_segments
 * @throws Error if the insertion fails
 */
export const insertArtistSegments = async (
  artistSegments: TablesInsert<"artist_segments">[],
): Promise<Tables<"artist_segments">[]> => {
  const { data, error } = await supabase.from("artist_segments").insert(artistSegments).select();

  if (error) {
    console.error("Error inserting artist segments:", error);
    throw error;
  }

  return data || [];
};
