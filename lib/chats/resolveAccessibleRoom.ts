import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";
import type { Tables } from "@/types/database.types";

const chatIdSchema = z.string().uuid("id must be a valid UUID");

interface ResolveAccessibleRoomResult {
  room: Tables<"rooms">;
  accountId: string;
}

/**
 * Resolves a chat room and validates access for the authenticated caller.
 *
 * @param request - The incoming request object for auth context.
 * @param id - The chat room ID from route params.
 * @returns The room and authenticated accountId, or an error NextResponse.
 */
export async function resolveAccessibleRoom(
  request: Request,
  id: string,
): Promise<ResolveAccessibleRoomResult | NextResponse> {
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

  return { room, accountId };
}
