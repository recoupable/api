import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import type { Tables } from "@/types/database.types";

/**
 * Validates a `GET /api/sessions/{sessionId}/chats/{chatId}` request
 * end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the session and confirms the caller owns it
 *   3. Loads the chat and confirms it belongs to the session
 *
 * Returns either a 401/403/404 NextResponse describing the first
 * failure, or the resolved chat row for the handler to render.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being fetched.
 * @returns A NextResponse on failure, or the chat row on success.
 */
export async function validateGetSessionChatRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | Tables<"chats">> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessionRows = await selectSessions({ id: sessionId });
  const session = sessionRows[0] ?? null;

  if (!session) {
    return NextResponse.json(
      { status: "error", error: "Session not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (session.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  const chatRows = (await selectChats({ id: chatId })) ?? [];
  const chat = chatRows[0] ?? null;

  if (!chat || chat.session_id !== sessionId) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return chat;
}
