import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type Room = Tables<"rooms">;

/**
 * Selects a room by its ID.
 *
 * @param roomId - The ID of the room to select
 * @returns The room data or null if not found
 */
export default async function selectRoom(roomId: string): Promise<Room | null> {
  if (!roomId) return null;

  const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();

  if (error) {
    return null;
  }

  return data;
}
