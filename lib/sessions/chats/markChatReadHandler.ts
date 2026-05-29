import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateMarkChatReadRequest } from "@/lib/sessions/chats/validateMarkChatReadRequest";
import { upsertChatRead } from "@/lib/supabase/chat_reads/upsertChatRead";

/**
 * Handles `POST /api/sessions/{sessionId}/chats/{chatId}/read`.
 * Upserts `chat_reads.last_read_at` for the authenticated account so
 * subsequent list-chats calls report `hasUnread: false` for this chat.
 *
 * @param request - The incoming request.
 * @param sessionId - The parent session id.
 * @param chatId - The chat id to mark as read.
 * @returns A NextResponse with `{ success: true }` on 200, or an error.
 */
export async function markChatReadHandler(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse> {
  const validated = await validateMarkChatReadRequest(request, sessionId, chatId);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const row = await upsertChatRead(validated.auth.accountId, chatId);
  if (!row) {
    return NextResponse.json(
      { status: "error", error: "Failed to mark chat as read" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json({ success: true }, { status: 200, headers: getCorsHeaders() });
}
