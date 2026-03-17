import supabase from "../serverClient";

/**
 * Selects memory IDs for the given room IDs.
 *
 * @param roomIds - Array of room IDs to query
 * @returns Array of memory ID strings
 */
export async function selectMemoryIdsByRoomIds(
  roomIds: string[],
): Promise<string[]> {
  if (roomIds.length === 0) return [];

  const { data, error } = await supabase
    .from("memories")
    .select("id")
    .in("room_id", roomIds);

  if (error) {
    console.error("Error fetching memory IDs:", error);
    return [];
  }

  return (data ?? []).map((m) => m.id);
}
