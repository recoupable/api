import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

export interface ValidatedChatAccess {
  roomId: string;
}

/**
 * Validates that the authenticated caller can access a chat room.
 *
 * @param request - The incoming request (used for auth context)
 * @param roomId - The room/chat UUID to validate access for
 * @returns NextResponse on auth/access failure, or validated roomId
 */
export async function validateChatAccess(
  request: NextRequest,
  roomId: string,
): Promise<NextResponse | ValidatedChatAccess> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  const room = await selectRoom(roomId);
  if (!room) {
    return NextResponse.json(
      { status: "error", error: "Chat room not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const { params } = await buildGetChatsParams({
    account_id: accountId,
  });

  // If params.account_ids is undefined, it means admin access (all records)
  if (params.account_ids && room.account_id) {
    if (!params.account_ids.includes(room.account_id)) {
      return NextResponse.json(
        { status: "error", error: "Access denied to this chat" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return { roomId };
}
