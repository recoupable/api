import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

/**
 * Validates a `GET /api/chats/{chatId}` request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the chat by id
 *   3. Confirms the caller owns the chat's parent session
 *
 * Mirrors `validateGetSessionChatRequest`'s ownership check, but resolves
 * the session from the chat row instead of requiring `sessionId` in the
 * path — so a client holding only a `/chat/[roomId]` URL can recover the
 * `sessionId` it needs for the workflow transport.
 *
 * Returns a 401/403/404 NextResponse for the first failure, or the chat row.
 *
 * @param request - The incoming request.
 * @param chatId - The id of the chat being fetched.
 * @returns A NextResponse on failure, or the chat row on success.
 */
export async function validateGetChatRequest(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | Tables<"chats">> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const chatRows = await selectChats({ id: chatId });
  const chat = chatRows[0] ?? null;

  if (!chat) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const sessionRows = await selectSessions({ id: chat.session_id });
  const session = sessionRows[0] ?? null;

  if (!session || session.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return chat;
}
