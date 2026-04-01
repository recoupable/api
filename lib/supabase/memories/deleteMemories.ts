import supabase from "@/lib/supabase/serverClient";

interface DeleteMemoriesOptions {
  fromTimestamp?: string;
  returnCount?: boolean;
}

export default async function deleteMemories(roomId: string): Promise<boolean>;
export default async function deleteMemories(
  roomId: string,
  options: DeleteMemoriesOptions & { returnCount: true },
): Promise<number | null>;
/**
 * Deletes all memories for the given room.
 *
 * @param roomId - The room ID whose memories should be deleted.
 * @param options - Optional filters and response mode for deletion.
 * @returns True when the delete operation succeeds.
 */
export default async function deleteMemories(
  roomId: string,
  options: DeleteMemoriesOptions = {},
): Promise<boolean | number | null> {
  let query = supabase
    .from("memories")
    .delete(options.returnCount ? { count: "exact" } : {})
    .eq("room_id", roomId);

  if (options.fromTimestamp) {
    query = query.gte("updated_at", options.fromTimestamp);
  }

  const { error, count } = await query;

  if (error) {
    console.error("Error deleting memories by room id:", error);
    return options.returnCount ? null : false;
  }

  return options.returnCount ? (count ?? 0) : true;
}
