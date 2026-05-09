import { deleteMemoriesByRoomIdAfterTimestamp } from "@/lib/supabase/deleteMemoriesByRoomIdAfterTimestamp";
import { getMemoryById } from "@/lib/supabase/getMemoryById";

/**
 * Deletes all memories in a room that come after the specified memory.
 *
 * @param params - Object containing the memory ID
 */
export async function deleteTrailingMessages({ id }: { id: string }) {
  const memory = await getMemoryById({ id });

  if (!memory) {
    throw new Error("Memory not found");
  }

  if (!memory.room_id) {
    throw new Error("Room ID not found");
  }

  await deleteMemoriesByRoomIdAfterTimestamp({
    roomId: memory.room_id,
    timestamp: new Date(memory.updated_at),
  });
}
