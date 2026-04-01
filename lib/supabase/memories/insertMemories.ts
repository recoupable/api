import supabase from "../serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Inserts one or more memories.
 *
 * @param memories - Memory records to insert.
 * @returns Number of inserted records.
 */
export default async function insertMemories(
  memories: TablesInsert<"memories">[],
): Promise<number> {
  if (memories.length === 0) {
    return 0;
  }

  const { data, error } = await supabase.from("memories").insert(memories).select("id");

  if (error) {
    console.error("Error inserting memories:", error);
    throw error;
  }

  return data?.length ?? 0;
}
