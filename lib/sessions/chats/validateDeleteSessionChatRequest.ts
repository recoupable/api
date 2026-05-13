import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import type { Tables } from "@/types/database.types";

export interface ValidatedDeleteSessionChatRequest {
  auth: AuthContext;
  session: Tables<"sessions">;
  chat: Tables<"chats">;
  /** Every chat in the session, used to enforce the "not the only chat" rule. */
  siblingChats: Tables<"chats">[];
}

/**
 * Validates a `DELETE /api/sessions/{sessionId}/chats/{chatId}`
 * request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the session and confirms the caller owns it
 *   3. Loads the chat and confirms it belongs to the session
 *   4. Loads every chat in the session and refuses 400 if this is the
 *      only one (sessions must always retain at least one chat)
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being deleted.
 * @returns A NextResponse on failure, or the validated payload.
 */
export async function validateDeleteSessionChatRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | ValidatedDeleteSessionChatRequest> {
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

  const siblingChats = await selectChats({ sessionId });
  const chat = siblingChats.find(row => row.id === chatId) ?? null;

  if (!chat) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (siblingChats.length <= 1) {
    return NextResponse.json(
      { status: "error", error: "Cannot delete the only chat in a session" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { auth, session, chat, siblingChats };
}
