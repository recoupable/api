import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { internalServerErrorResponse } from "@/lib/networking/internalServerErrorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";

/**
 * Validates a `DELETE /api/sessions/{sessionId}/chats/{chatId}`
 * request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the session and confirms the caller owns it
 *   3. Loads every chat in the session, confirms the target chat is
 *      one of them, and refuses 400 if it's the only one (sessions
 *      must always retain at least one chat)
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being deleted.
 * @returns A NextResponse on failure, or `null` when validation passes.
 */
export async function validateDeleteSessionChatRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | null> {
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
  if (siblingChats === null) {
    return internalServerErrorResponse();
  }

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

  return null;
}
