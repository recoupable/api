import supabase from "@/lib/supabase/serverClient";

interface DeleteMemoriesOptions {
  fromTimestamp?: string;
}

/**
 * Deletes all memories for the given room.
 *
 * @param roomId - The room ID whose memories should be deleted.
 * @param options - Optional timestamp filter for trailing deletion use cases.
 * @returns True when the delete operation succeeds.
 */
export default async function deleteMemories(
  roomId: string,
  options: DeleteMemoriesOptions = {},
): Promise<boolean> {
  let query = supabase.from("memories").delete().eq("room_id", roomId);

  if (options.fromTimestamp) {
    query = query.gte("updated_at", options.fromTimestamp);
  }

  const { error } = await query;

  if (error) {
    console.error("Error deleting memories by room id:", error);
    return false;
  }

  return true;
}
