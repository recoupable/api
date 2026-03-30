import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import selectRoom from "@/lib/supabase/rooms/selectRoom";

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Handles GET /api/chats/[id]/artist.
 *
 * Returns the artist associated with a chat room if accessible by the caller.
 *
 * @param request - The incoming request object for auth context.
 * @param id - The chat room ID from route params.
 * @returns A NextResponse with artist linkage data or an error.
 */
export async function getChatArtistHandler(request: Request, id: string): Promise<NextResponse> {
  const parsedId = chatIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        status: "error",
        error: parsedId.error.issues[0]?.message || "Invalid chat ID",
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;
  const room = await selectRoom(parsedId.data);

  if (!room) {
    return NextResponse.json(
      {
        status: "error",
        error: "Chat room not found",
      },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const roomAccountId = room.account_id;
  if (!roomAccountId) {
    return NextResponse.json(
      {
        status: "error",
        error: "Chat room is missing account_id",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  if (roomAccountId !== accountId) {
    const hasAccess = await canAccessAccount({
      currentAccountId: accountId,
      targetAccountId: roomAccountId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        {
          status: "error",
          error: "Chat room not found",
        },
        { status: 404, headers: getCorsHeaders() },
      );
    }
  }

  return NextResponse.json(
    {
      status: "success",
      room_id: room.id,
      artist_id: room.artist_id,
      artist_exists: Boolean(room.artist_id),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
