import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Memory = Tables<"memories">;

type InsertMemoryParams = Pick<Memory, "id" | "room_id" | "content">;

/**
 * Inserts a new memory into the memories table
 *
 * @param params - The parameters for the memory
 * @param params.id - The ID of the memory
 * @param params.room_id - The ID of the room
 * @param params.content - The content of the memory
 * @returns The inserted memory, or null if the insert fails
 */
export default async function insertMemories(params: InsertMemoryParams): Promise<Memory | null> {
  const { data, error } = await supabase.from("memories").insert(params).select().single();

  if (error) {
    console.error("Error creating memory:", error);
    throw error;
  }

  return data;
}
