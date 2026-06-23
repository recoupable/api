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

export interface ValidateChatAccessOptions {
  /**
   * Opt-in admin bypass. When true, a Recoup admin (member of `RECOUP_ORG_ID`)
   * is granted access to any room without the ownership check — so an admin can
   * read a customer's chat by id. Only read endpoints set this; chat mutations
   * leave it off so admin write access stays gated by ownership.
   */
  allowAdmin?: boolean;
}

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Validates that the authenticated caller can access a chat room.
 *
 * The room is fully identified by `roomId`, so no account override is accepted.
 * When `options.allowAdmin` is set, a Recoup admin bypasses the ownership check
 * (the room's owner is resolved server-side); everyone else must own the room.
 *
 * @param request - The incoming request (used for auth context)
 * @param roomId - The room/chat UUID to validate access for
 * @param options - Optional admin-bypass opt-in (read endpoints only)
 * @returns NextResponse on auth/access failure, or validated access data
 */
export async function validateChatAccess(
  request: NextRequest,
  roomId: string,
  options: ValidateChatAccessOptions = {},
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

  // Admin bypass (read endpoints only): a Recoup admin may access any room.
  // The owner is resolved server-side, so no account_id input is needed.
  if (options.allowAdmin && (await checkIsAdmin(accountId))) {
    return { roomId: room.id, room, accountId: room.account_id ?? accountId };
  }

  const { params, error } = await buildGetChatsParams({
    account_id: accountId,
  });

  if (!params) {
    return NextResponse.json(
      { status: "error", error: error ?? "Access denied" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  if (!room.account_id || !params.account_ids.includes(room.account_id)) {
    return NextResponse.json(
      { status: "error", error: "Access denied to this chat" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { roomId: room.id, room, accountId };
}
