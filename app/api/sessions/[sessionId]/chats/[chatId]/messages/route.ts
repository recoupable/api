import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { persistSessionChatAssistantMessageHandler } from "@/lib/sessions/chats/persistSessionChatAssistantMessageHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/sessions/{sessionId}/chats/{chatId}/messages
 *
 * Upserts an assistant UI message for the given chat. Authenticates via Privy
 * Bearer token or `x-api-key`; returns **404** when the session or chat is
 * missing or mismatched, **403** when the session is owned by another account.
 *
 * @param request - The incoming request.
 * @param options - Route options containing async params.
 * @param options.params - Async route params containing `sessionId` and `chatId`.
 * @returns JSON success `{ success, status }` or documented error payloads.
 */
export async function POST(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string; chatId: string }> },
) {
  const { sessionId, chatId } = await options.params;
  return persistSessionChatAssistantMessageHandler(request, sessionId, chatId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
