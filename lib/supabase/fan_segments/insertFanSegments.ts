import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts fan_segments associations into the database.
 *
 * @param fanSegments - Array of fan_segment objects to insert
 * @returns Array of inserted fan_segments
 * @throws Error if the insertion fails
 */
export const insertFanSegments = async (
  fanSegments: TablesInsert<"fan_segments">[],
): Promise<Tables<"fan_segments">[]> => {
  const { data, error } = await supabase.from("fan_segments").insert(fanSegments).select();

  if (error) {
    console.error("Error inserting fan segments:", error);
    throw error;
  }

  return data || [];
};
