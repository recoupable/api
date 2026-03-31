import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes memories in a room at/after a given timestamp.
 *
 * @param roomId - Room/chat ID.
 * @param timestamp - ISO timestamp threshold.
 * @returns Number of deleted rows, or null on failure.
 */
export default async function deleteMemoriesByRoomIdAfterTimestamp(
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
