import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts segments into the database.
 *
 * @param segments - Array of segment objects to insert
 * @returns Array of inserted segments
 * @throws Error if the insertion fails
 */
export const insertSegments = async (
  segments: TablesInsert<"segments">[],
): Promise<Tables<"segments">[]> => {
  const { data, error } = await supabase.from("segments").insert(segments).select();

  if (error) {
    console.error("Error inserting segments:", error);
    throw error;
  }

  return data || [];
};
