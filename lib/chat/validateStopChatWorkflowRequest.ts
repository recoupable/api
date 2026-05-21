import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { errorResponse } from "@/lib/networking/errorResponse";
import type { Tables } from "@/types/database.types";

export interface ValidatedStopChatWorkflowRequest {
  auth: AuthContext;
  chat: Tables<"chats">;
}

/**
 * Validates a `POST /api/chat/{chatId}/stop` request end-to-end:
 *   1. Authenticates the caller (Privy Bearer / x-api-key).
 *   2. Loads the chat at the given id (404 when missing).
 *   3. Loads the chat's parent session and confirms the authenticated
 *      account owns it: 403 on mismatch, 404 when the session is gone,
 *      500 on a DB error.
 *
 * Ownership is enforced through the session because `chats` carries no
 * account column — the session is the row that belongs to an account.
 *
 * @param request - The incoming request.
 * @param chatId - The chat id from the route path.
 * @returns A NextResponse on failure, or the validated auth + chat row.
 */
export async function validateStopChatWorkflowRequest(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedStopChatWorkflowRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  const chats = await selectChats({ id: chatId });
  const chat = chats[0];
  if (!chat) return errorResponse("Chat not found", 404);

  const sessions = await selectSessions({ id: chat.session_id });
  if (sessions === null) return errorResponse("Internal server error", 500);
  const session = sessions[0];
  if (!session) return errorResponse("Chat not found", 404);
  if (session.account_id !== auth.accountId) return errorResponse("Forbidden", 403);

  return { auth, chat };
}
