import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { internalServerErrorResponse } from "@/lib/networking/internalServerErrorResponse";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateSessionChatRequest } from "@/lib/sessions/chats/validateCreateSessionChatRequest";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { toChatResponse } from "@/lib/sessions/toChatResponse";

const INITIAL_CHAT_TITLE = "New chat";

/**
 * Handles `POST /api/sessions/{sessionId}/chats`.
 *
 * Callers may pass `{ id }` to claim a deterministic chat id: if a row
 * already exists with that id and belongs to this session, it is
 * returned as-is (idempotent retry); if it exists on a different
 * session, 409 is returned. Otherwise a new chat is inserted with
 * title "New chat".
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @returns A NextResponse with `{ chat }` on 200, `{ error }` on 4xx, or an error.
 */
export async function createSessionChatHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const validated = await validateCreateSessionChatRequest(request, sessionId);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { body } = validated;

  const requestedChatId = body.id ?? null;

  if (requestedChatId) {
    const existingRows = await selectChats({ id: requestedChatId });
    if (existingRows === null) {
      return internalServerErrorResponse();
    }

    const existing = existingRows[0] ?? null;
    if (existing) {
      if (existing.session_id !== sessionId) {
        return NextResponse.json(
          { error: "Chat ID conflict" },
          { status: 409, headers: getCorsHeaders() },
        );
      }
      return NextResponse.json(
        { chat: toChatResponse(existing) },
        { status: 200, headers: getCorsHeaders() },
      );
    }
  }

  const chatRow = await insertChat({
    id: requestedChatId ?? generateUUID(),
    session_id: sessionId,
    title: INITIAL_CHAT_TITLE,
  });

  if (!chatRow) {
    return NextResponse.json(
      { status: "error", error: "Failed to create chat" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { chat: toChatResponse(chatRow) },
    { status: 200, headers: getCorsHeaders() },
  );
}
