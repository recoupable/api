import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";

/**
 * Handles GET /api/chats/[id]/artist.
 *
 * Returns the artist associated with a chat room if accessible by the caller.
 *
 * @param request - The incoming request object for auth context.
 * @param id - The chat room ID from route params.
 * @returns A NextResponse with artist linkage data or an error.
 */
export async function getChatArtistHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const roomResult = await validateChatAccess(request, id);
  if (roomResult instanceof NextResponse) {
    return roomResult;
  }

  return NextResponse.json(
    {
      status: "success",
      room_id: roomResult.room.id,
      artist_id: roomResult.room.artist_id,
      artist_exists: Boolean(roomResult.room.artist_id),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
