import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetChatRequest } from "@/lib/chats/validateGetChatRequest";
import { toChatResponse } from "@/lib/sessions/toChatResponse";

export interface ChatResponse {
  chat: ReturnType<typeof toChatResponse>;
}

/**
 * Handles `GET /api/chats/{chatId}`. Returns the chat row in camelCase
 * wire format (incl. `sessionId`), so a client holding only a
 * `/chat/[roomId]` URL can recover the `sessionId` the workflow
 * transport and `chat_messages` history read require.
 *
 * @param request - The incoming request (carries auth).
 * @param chatId - The chat id from the route params.
 * @returns A NextResponse with `{ chat }` on 200, or a 401/403/404 error.
 */
export async function getChatHandler(request: NextRequest, chatId: string): Promise<NextResponse> {
  const chat = await validateGetChatRequest(request, chatId);
  if (chat instanceof NextResponse) {
    return chat;
  }

  return NextResponse.json({ chat: toChatResponse(chat) } satisfies ChatResponse, {
    status: 200,
    headers: getCorsHeaders(),
  });
}
