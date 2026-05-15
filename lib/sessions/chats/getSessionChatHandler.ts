import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { toChatResponse } from "@/lib/sessions/toChatResponse";
import { validateGetSessionChatRequest } from "@/lib/sessions/chats/validateGetSessionChatRequest";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

export interface SessionChatResponse {
  chat: ReturnType<typeof toChatResponse>;
  isStreaming: boolean;
  messages: unknown[];
}

/**
 * Handles `GET /api/sessions/{sessionId}/chats/{chatId}`. Returns the
 * chat row (camelCase wire format), its streaming state, and the
 * persisted UI message stream — enough for both initial render and
 * in-tab refresh.
 *
 * `messages` is the raw `parts` JSON for each row (chat messages are
 * stored as the full UIMessage; the caller deserializes back into
 * its UIMessage type).
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being fetched.
 * @returns A NextResponse with `{ chat, isStreaming, messages }` on 200, or an error.
 */
export async function getSessionChatHandler(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse> {
  const chat = await validateGetSessionChatRequest(request, sessionId, chatId);
  if (chat instanceof NextResponse) {
    return chat;
  }

  const messages = await selectChatMessages({ chatId });

  return NextResponse.json(
    {
      chat: toChatResponse(chat),
      isStreaming: chat.active_stream_id !== null,
      messages: messages.map(row => row.parts),
    } satisfies SessionChatResponse,
    { status: 200, headers: getCorsHeaders() },
  );
}
