import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes a room by ID. Related records are removed automatically via ON DELETE CASCADE.
 *
 * @param roomId - The room ID to delete
 * @returns The deleted room data, or null on error
 */
export async function deleteRoom(roomId: string) {
  const { data, error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    console.error("Error deleting room:", error);
    return null;
  }

  return data;
}
