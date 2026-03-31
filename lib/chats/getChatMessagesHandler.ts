import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";
import selectMemories from "@/lib/supabase/memories/selectMemories";

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Handles GET /api/chats/[id]/messages.
 *
 * Returns all messages for a chat in ascending order by `updated_at`.
 *
 * @param request - Incoming request used to validate chat access.
 * @param id - Chat identifier from route params.
 * @returns JSON response containing ordered chat messages.
 */
export async function getChatMessagesHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
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

    const roomResult = await validateChatAccess(request, parsedId.data);
    if (roomResult instanceof NextResponse) {
      return roomResult;
    }

    const memories = await selectMemories(roomResult.room.id, { ascending: true });
    if (memories === null) {
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to retrieve memories",
        },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        data: memories,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Unexpected error in getChatMessagesHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to retrieve memories",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
