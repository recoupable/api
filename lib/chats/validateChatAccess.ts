import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";
import type { Tables } from "@/types/database.types";

export interface ValidatedChatAccess {
  roomId: string;
  room: Tables<"rooms">;
  accountId: string;
}

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Validates that the authenticated caller can access a chat room.
 *
 * The room is fully identified by `roomId`, so no account override is accepted.
 * Access is granted to the room's owner; a Recoup admin (`RECOUP_ORG_ID` member)
 * may access any room. The admin check runs only when the ownership check fails,
 * so the common owner path never pays the extra lookup.
 *
 * @param request - The incoming request (used for auth context)
 * @param roomId - The room/chat UUID to validate access for
 * @returns NextResponse on auth/access failure, or validated access data
 */
export async function validateChatAccess(
  request: NextRequest,
  roomId: string,
): Promise<NextResponse | ValidatedChatAccess> {
  const roomIdResult = chatIdSchema.safeParse(roomId);
  if (!roomIdResult.success) {
    return NextResponse.json(
      { status: "error", error: roomIdResult.error.issues[0]?.message || "Invalid chat ID" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  const room = await selectRoom(roomIdResult.data);
  if (!room) {
    return NextResponse.json(
      { status: "error", error: "Chat room not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const { params } = await buildGetChatsParams({ account_id: accountId });

  const isOwner = !!params && !!room.account_id && params.account_ids.includes(room.account_id);
  if (isOwner) {
    return { roomId: room.id, room, accountId };
  }

  // Non-owner: a Recoup admin may access any chat (read or write). The owner is
  // resolved server-side, so no account_id input is needed. Checked only here so
  // the owner path above never pays the lookup.
  if (await checkIsAdmin(accountId)) {
    return { roomId: room.id, room, accountId: room.account_id ?? accountId };
  }

  return NextResponse.json(
    { status: "error", error: "Access denied to this chat" },
    { status: 403, headers: getCorsHeaders() },
  );
}
