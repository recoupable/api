import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePersistSessionChatAssistantMessageRequest } from "@/lib/sessions/chats/validatePersistSessionChatAssistantMessageRequest";
import { selectChatMessageById } from "@/lib/supabase/chat_messages/selectChatMessageById";
import { insertChatMessage } from "@/lib/supabase/chat_messages/insertChatMessage";
import { updateChatMessageParts } from "@/lib/supabase/chat_messages/updateChatMessageParts";
import { updateChat } from "@/lib/supabase/chats/updateChat";

/**
 * Handles `POST /api/sessions/{sessionId}/chats/{chatId}/messages`.
 *
 * Upserts an assistant-branch message into `chat_messages`, updates
 * `chats.last_assistant_message_at`, and mirrors chat-route auth/error shapes.
 *
 * @param request - Incoming POST request.
 * @param sessionId - Parent session id from the route.
 * @param chatId - Chat id from the route.
 */
export async function persistSessionChatAssistantMessageHandler(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse> {
  const validated = await validatePersistSessionChatAssistantMessageRequest(
    request,
    sessionId,
    chatId,
  );
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { message } = validated;

  const existing = await selectChatMessageById(message.id);

  if (existing) {
    if (existing.chat_id !== chatId || existing.role !== "assistant") {
      return NextResponse.json(
        { error: "Message ID already belongs to a different chat or role" },
        { status: 409, headers: getCorsHeaders() },
      );
    }

    const updated = await updateChatMessageParts(message.id, message.parts);
    if (!updated) {
      return NextResponse.json(
        { status: "error", error: "Failed to persist message" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    const touched = await updateChat(chatId, {
      last_assistant_message_at: new Date().toISOString(),
    });
    if (!touched) {
      return NextResponse.json(
        { status: "error", error: "Failed to persist message" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { success: true, status: "updated" },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  const inserted = await insertChatMessage({
    id: message.id,
    chat_id: chatId,
    role: "assistant",
    parts: message.parts,
  });

  if (!inserted) {
    return NextResponse.json(
      { status: "error", error: "Failed to persist message" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  const touched = await updateChat(chatId, { last_assistant_message_at: new Date().toISOString() });
  if (!touched) {
    return NextResponse.json(
      { status: "error", error: "Failed to persist message" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { success: true, status: "inserted" },
    { status: 200, headers: getCorsHeaders() },
  );
}
