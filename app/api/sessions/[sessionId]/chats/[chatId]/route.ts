import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSessionChatHandler } from "@/lib/sessions/chats/getSessionChatHandler";
import { patchSessionChatHandler } from "@/lib/sessions/chats/patchSessionChatHandler";
import { deleteSessionChatHandler } from "@/lib/sessions/chats/deleteSessionChatHandler";

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
 * GET /api/sessions/{sessionId}/chats/{chatId}
 *
 * Returns the chat's persisted UI message stream plus its current
 * streaming state. Authenticates via Privy Bearer token or
 * `x-api-key`; 404s when the session or chat is missing (or the chat
 * lives in a different session) and 403s when the session is owned by
 * a different account.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the session id and chat id.
 * @returns A NextResponse with `{ chat, isStreaming, messages }` on 200, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string; chatId: string }> },
) {
  const { sessionId, chatId } = await options.params;
  return getSessionChatHandler(request, sessionId, chatId);
}

/**
 * PATCH /api/sessions/{sessionId}/chats/{chatId}
 *
 * Applies a partial update to the chat (`title` and/or `modelId`).
 * Body must include at least one of those non-empty fields.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the session id and chat id.
 * @returns A NextResponse with `{ chat }` on 200, or an error.
 */
export async function PATCH(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string; chatId: string }> },
) {
  const { sessionId, chatId } = await options.params;
  return patchSessionChatHandler(request, sessionId, chatId);
}

/**
 * DELETE /api/sessions/{sessionId}/chats/{chatId}
 *
 * Removes the chat (cascade clears `chat_messages` / `chat_reads`).
 * Refuses with 400 if the chat is the only one in its session.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the session id and chat id.
 * @returns A NextResponse with `{ success: true }` on 200, or an error.
 */
export async function DELETE(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string; chatId: string }> },
) {
  const { sessionId, chatId } = await options.params;
  return deleteSessionChatHandler(request, sessionId, chatId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
