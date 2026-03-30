import supabase from "../serverClient";

/**
 * Deletes a room and related room data.
 * This removes memory_emails, memories, room_reports, segment_rooms, then the room.
 *
 * @param roomId - The room ID to delete
 * @returns True when deletion succeeds, false when any step fails
 */
export async function deleteRoomWithRelations(roomId: string): Promise<boolean> {
  const { data: memories, error: selectMemoriesError } = await supabase
    .from("memories")
    .select("id")
    .eq("room_id", roomId);

  if (selectMemoriesError) {
    console.error("[ERROR] deleteRoomWithRelations select memories:", selectMemoriesError);
    return false;
  }

  const memoryIds = (memories || []).map(memory => memory.id);

  if (memoryIds.length > 0) {
    const { error: deleteMemoryEmailsError } = await supabase
      .from("memory_emails")
      .delete()
      .in("memory", memoryIds);

    if (deleteMemoryEmailsError) {
      console.error("[ERROR] deleteRoomWithRelations memory_emails:", deleteMemoryEmailsError);
      return false;
    }
  }

  const { error: deleteMemoriesError } = await supabase
    .from("memories")
    .delete()
    .eq("room_id", roomId);
  if (deleteMemoriesError) {
    console.error("[ERROR] deleteRoomWithRelations memories:", deleteMemoriesError);
    return false;
  }

  const { error: deleteRoomReportsError } = await supabase
    .from("room_reports")
    .delete()
    .eq("room_id", roomId);
  if (deleteRoomReportsError) {
    console.error("[ERROR] deleteRoomWithRelations room_reports:", deleteRoomReportsError);
    return false;
  }

  const { error: deleteSegmentRoomsError } = await supabase
    .from("segment_rooms")
    .delete()
    .eq("room_id", roomId);
  if (deleteSegmentRoomsError) {
    console.error("[ERROR] deleteRoomWithRelations segment_rooms:", deleteSegmentRoomsError);
    return false;
  }

  const { error: deleteRoomError } = await supabase.from("rooms").delete().eq("id", roomId);

  if (deleteRoomError) {
    console.error("[ERROR] deleteRoomWithRelations room:", deleteRoomError);
    return false;
  }

  return true;
}
