import supabase from "@/lib/supabase/serverClient";

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
    console.error("[WARN] deleteRoomWithRelations select memories:", selectMemoriesError);
  }

  const memoryIds = (memories || []).map(memory => memory.id);

  if (memoryIds.length > 0) {
    const { error: deleteMemoryEmailsError } = await supabase
      .from("memory_emails")
      .delete()
      .in("memory", memoryIds);

    if (deleteMemoryEmailsError) {
      console.error("[WARN] deleteRoomWithRelations memory_emails:", deleteMemoryEmailsError);
    }
  }

  const { error: deleteMemoriesError } = await supabase
    .from("memories")
    .delete()
    .eq("room_id", roomId);
  if (deleteMemoriesError) {
    console.error("[WARN] deleteRoomWithRelations memories:", deleteMemoriesError);
  }

  const { error: deleteRoomReportsError } = await supabase
    .from("room_reports")
    .delete()
    .eq("room_id", roomId);
  if (deleteRoomReportsError) {
    console.error("[WARN] deleteRoomWithRelations room_reports:", deleteRoomReportsError);
  }

  const { error: deleteSegmentRoomsError } = await supabase
    .from("segment_rooms")
    .delete()
    .eq("room_id", roomId);
  if (deleteSegmentRoomsError) {
    console.error("[WARN] deleteRoomWithRelations segment_rooms:", deleteSegmentRoomsError);
  }

  const { error: deleteRoomError } = await supabase.from("rooms").delete().eq("id", roomId);

  if (deleteRoomError) {
    console.error("[ERROR] deleteRoomWithRelations room:", deleteRoomError);
    return false;
  }

  return true;
}
