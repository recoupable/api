import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import deleteMemories from "@/lib/supabase/memories/deleteMemories";

/**
 * Handles DELETE /api/chats/[id]/messages/trailing.
 *
 * @param request - Incoming request object.
 * @param chatId - Chat UUID from route params.
 * @returns JSON response indicating deletion result or error.
 */
export async function deleteTrailingChatMessagesHandler(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse> {
  try {
    const validated = await validateDeleteTrailingMessagesQuery(request, chatId);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const deleted = await deleteMemories(validated.chatId, {
      fromTimestamp: validated.fromTimestamp,
    });

    if (!deleted) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete trailing messages" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        chat_id: validated.chatId,
        from_message_id: validated.fromMessageId,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Unexpected error in deleteTrailingChatMessagesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to delete trailing messages" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
