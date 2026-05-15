import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSessionChatRequest } from "@/lib/sessions/chats/validateGetSessionChatRequest";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

export interface SessionChatResponse {
  chat: {
    id: string;
    modelId: string | null;
    activeStreamId: string | null;
  };
  isStreaming: boolean;
  messages: unknown[];
}

/**
 * Handles `GET /api/sessions/{sessionId}/chats/{chatId}`. Returns the
 * chat's persisted UI message stream plus its current streaming state
 * so the frontend can hydrate / refresh a chat view.
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
      chat: {
        id: chat.id,
        modelId: chat.model_id,
        activeStreamId: chat.active_stream_id,
      },
      isStreaming: chat.active_stream_id !== null,
      messages: messages.map(row => row.parts),
    } satisfies SessionChatResponse,
    { status: 200, headers: getCorsHeaders() },
  );
}
