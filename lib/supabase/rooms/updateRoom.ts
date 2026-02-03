import supabase from "../serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

type Room = Tables<"rooms">;

/**
 * Updates a room's topic by ID.
 *
 * @param roomId - The ID of the room to update
 * @param updates - The fields to update
 * @returns The updated room data or null if not found or error
 */
export async function updateRoom(
  roomId: string,
  updates: TablesUpdate<"rooms">,
): Promise<Room | null> {
  const { data, error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("id", roomId)
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] updateRoom:", error);
    return null;
  }

  return data;
}
