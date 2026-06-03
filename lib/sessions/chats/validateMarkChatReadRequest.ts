import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { internalServerErrorResponse } from "@/lib/networking/internalServerErrorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import type { Tables } from "@/types/database.types";

export interface ValidatedMarkChatReadRequest {
  auth: AuthContext;
  session: Tables<"sessions">;
  chat: Tables<"chats">;
}

/**
 * Validates `POST /api/sessions/{sessionId}/chats/{chatId}/read`:
 *   1. Authenticates the caller
 *   2. Loads the session and chat
 *   3. Confirms the account owns the session and the chat belongs to it
 *
 * @param request - The incoming request.
 * @param sessionId - The parent session id.
 * @param chatId - The chat id to mark as read.
 * @returns A NextResponse on failure, or the validated auth + session + chat.
 */
export async function validateMarkChatReadRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | ValidatedMarkChatReadRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const [sessionRows, chatRows] = await Promise.all([
    selectSessions({ id: sessionId }),
    selectChats({ id: chatId }),
  ]);

  if (sessionRows === null) {
    return internalServerErrorResponse();
  }
  if (chatRows === null) {
    return internalServerErrorResponse();
  }

  const session = sessionRows[0] ?? null;
  const chat = chatRows[0] ?? null;

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

  if (!chat || chat.session_id !== sessionId) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return { auth, session, chat };
}
