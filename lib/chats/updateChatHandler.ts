import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdateChatBody } from "./validateUpdateChatBody";
import { updateRoom } from "@/lib/supabase/rooms/updateRoom";

/**
 * Handles PATCH /api/chats - Update a chat room's topic.
 *
 * @param request - The NextRequest object
 * @returns NextResponse with updated chat data or error
 */
export async function updateChatHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateUpdateChatBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { chatId, topic } = validated;

  try {
    const updated = await updateRoom(chatId, { topic });
    if (!updated) {
      return NextResponse.json(
        { status: "error", error: "Failed to update chat" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        chat: {
          id: updated.id,
          account_id: updated.account_id,
          topic: updated.topic,
          updated_at: updated.updated_at,
          artist_id: updated.artist_id,
        },
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
