import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAccessibleRoom } from "@/lib/chats/resolveAccessibleRoom";

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
  const roomResult = await resolveAccessibleRoom(request, roomId);
  if (roomResult instanceof NextResponse) {
    return roomResult;
  }

  return { roomId: roomResult.room.id };
}
