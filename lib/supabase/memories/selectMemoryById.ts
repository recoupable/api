import type { Tables } from "@/types/database.types";
import supabase from "@/lib/supabase/serverClient";

type MemoryRow = Pick<Tables<"memories">, "id" | "room_id" | "updated_at">;

/**
 * Selects a memory by its ID.
 *
 * @param memoryId - The memory UUID.
 * @returns The memory row or null when not found/error.
 */
export default async function selectMemoryById(memoryId: string): Promise<MemoryRow | null> {
  const { data, error } = await supabase
    .from("memories")
    .select("id, room_id, updated_at")
    .eq("id", memoryId)
    .maybeSingle();

  if (error) {
    console.error("Error selecting memory by id:", error);
    return null;
  }

  return data;
}
