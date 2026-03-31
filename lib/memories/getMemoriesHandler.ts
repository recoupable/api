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
 * Returns all memories for a room in ascending order by updated_at.
 * Requires the caller to have access to the target room.
 */
export async function getMemoriesHandler(request: NextRequest, id: string): Promise<NextResponse> {
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
}
