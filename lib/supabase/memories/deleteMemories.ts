import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes all memories for the given room.
 *
 * @param roomId - The room ID whose memories should be deleted.
 * @returns True when the delete operation succeeds.
 */
export default async function deleteMemories(roomId: string): Promise<boolean> {
  const { error } = await supabase.from("memories").delete().eq("room_id", roomId);

  if (error) {
    console.error("Error deleting memories by room id:", error);
    return false;
  }

  return true;
}

/**
 * Deletes memories for the given room at/after a timestamp.
 *
 * @param roomId - The room ID whose memories should be deleted.
 * @param timestamp - ISO timestamp threshold (inclusive).
 * @returns Number of deleted rows, or null on failure.
 */
export async function deleteMemoriesAfterTimestamp(
  roomId: string,
  timestamp: string,
): Promise<number | null> {
  const { error, count } = await supabase
    .from("memories")
    .delete({ count: "exact" })
    .eq("room_id", roomId)
    .gte("updated_at", timestamp);

  if (error) {
    console.error("Error deleting trailing memories:", error);
    return null;
  }

  return count ?? 0;
}
