import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves a segment_rooms row by room_id.
 *
 * @param roomId - The chat room ID.
 * @returns The first matching segment_rooms row or null if none exists.
 */
export async function selectSegmentRoomByRoomId(
  roomId: string,
): Promise<Tables<"segment_rooms"> | null> {
  const { data, error } = await supabase
    .from("segment_rooms")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error("[ERROR] selectSegmentRoomByRoomId:", error);
    throw error;
  }

  return data;
}
