import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Memory = Tables<"memories">;

type UpsertMemoryParams = Pick<Memory, "id" | "room_id" | "content">;

/**
 * Upserts a memory into the memories table.
 * If a memory with the same ID exists, it will be updated.
 *
 * @param params - The parameters for the memory
 * @param params.id - The ID of the memory
 * @param params.room_id - The ID of the room
 * @param params.content - The content of the memory
 * @returns The upserted memory, or null if the upsert fails
 */
export default async function upsertMemory(params: UpsertMemoryParams): Promise<Memory | null> {
  const { data, error } = await supabase
    .from("memories")
    .upsert(params, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("Error upserting memory:", error);
    throw error;
  }

  return data;
}
