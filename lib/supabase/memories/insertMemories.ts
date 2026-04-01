import type { Tables } from "@/types/database.types";
import supabase from "@/lib/supabase/serverClient";

type InsertCopiedMemoryParams = Pick<
  Tables<"memories">,
  "id" | "room_id" | "content" | "updated_at"
>[];

/**
 * Inserts a batch of copied memories.
 *
 * @param memories - Memory records to insert.
 * @returns Number of inserted records.
 */
export default async function insertMemories(
  memories: InsertCopiedMemoryParams,
): Promise<number> {
  if (memories.length === 0) {
    return 0;
  }

  const { data, error } = await supabase.from("memories").insert(memories).select("id");

  if (error) {
    console.error("Error inserting copied memories:", error);
    throw error;
  }

  return data?.length ?? 0;
}
