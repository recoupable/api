import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import generateUUID from "@/lib/uuid/generateUUID";

/**
 * Create a new room based on an existing room's data.
 * Does not copy messages - only creates a new room with the same topic.
 *
 * @param sourceRoomId - The ID of the source room to use as a template
 * @param artistId - The ID of the artist for the new room
 * @returns The ID of the new room or null if operation failed
 */
export async function copyRoom(
  sourceRoomId: string,
  artistId: string,
): Promise<string | null> {
  try {
    // Get the source room data
    const sourceRoom = await selectRoom(sourceRoomId);

    if (!sourceRoom) {
      return null;
    }

    // Generate new room ID
    const newRoomId = generateUUID();

    // Create new room with same account but new artist
    await insertRoom({
      id: newRoomId,
      account_id: sourceRoom.account_id,
      artist_id: artistId,
      topic: sourceRoom.topic || "New conversation",
    });

    return newRoomId;
  } catch {
    return null;
  }
}
