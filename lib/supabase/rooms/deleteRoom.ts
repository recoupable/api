import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes a room by ID. Related records are removed automatically via ON DELETE CASCADE.
 *
 * @param roomId - The room ID to delete
 * @returns True when deletion succeeds, false on error
 */
export async function deleteRoom(roomId: string): Promise<boolean> {
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);

  if (error) {
    console.error("Error deleting room:", error);
    return false;
  }

  return true;
}
