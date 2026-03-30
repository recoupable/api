import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { resolveAccessibleRoom } from "@/lib/chats/resolveAccessibleRoom";
import { selectSegmentRoomByRoomId } from "@/lib/supabase/segment_rooms/selectSegmentRoomByRoomId";

/**
 * Handles GET /api/chats/[id]/segment.
 *
 * Returns the segment associated with a chat room if one exists.
 *
 * @param request - The incoming request object for auth context.
 * @param id - The chat room ID from route params.
 * @returns A NextResponse with segment linkage data or an error.
 */
export async function getChatSegmentHandler(request: Request, id: string): Promise<NextResponse> {
  const roomResult = await resolveAccessibleRoom(request, id);
  if (roomResult instanceof NextResponse) {
    return roomResult;
  }

  const segmentRoom = await selectSegmentRoomByRoomId(roomResult.room.id);

  return NextResponse.json(
    {
      status: "success",
      room_id: roomResult.room.id,
      segment_id: segmentRoom?.segment_id || null,
      segment_exists: Boolean(segmentRoom?.segment_id),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
