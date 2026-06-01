import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteSessionChatRequest } from "@/lib/sessions/chats/validateDeleteSessionChatRequest";
import { deleteChat } from "@/lib/supabase/chats/deleteChat";

/**
 * Handles `DELETE /api/sessions/{sessionId}/chats/{chatId}`. Removes
 * the chat row (cascade clears `chat_messages` / `chat_reads`).
 * Refuses with 400 if the chat is the only one in its session.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being deleted.
 * @returns A NextResponse with `{ success: true }` on 200, or an error.
 */
export async function deleteSessionChatHandler(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse> {
  const failure = await validateDeleteSessionChatRequest(request, sessionId, chatId);
  if (failure) {
    return failure;
  }

  const ok = await deleteChat(chatId);
  if (!ok) {
    return NextResponse.json(
      { status: "error", error: "Failed to delete chat" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json({ success: true }, { status: 200, headers: getCorsHeaders() });
}
