import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { errorResponse } from "@/lib/networking/errorResponse";

export type GetChatStreamRequest = {
  chat: Awaited<ReturnType<typeof selectChats>>[number];
  accountId: string;
};

/**
 * Validates a GET /api/chat/[chatId]/stream request: authenticates the caller
 * (x-api-key or Authorization bearer) and verifies they own the chat via its
 * parent session. Returns a NextResponse error short-circuit (401/403/404/500)
 * or the resolved chat row.
 *
 * Resume reattaches to a durable workflow run, so no sandbox-active check is
 * needed here — the run lives in workflow infra, not the sandbox.
 *
 * @param request - The incoming GET request (auth headers only; no body).
 * @param chatId - Chat identifier from the route params.
 * @returns A NextResponse error or the validated, owned chat row.
 */
export async function validateGetChatStreamRequest(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | GetChatStreamRequest> {
  if (!chatId) return errorResponse("chatId is required", 400);

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

  return { chat, accountId: auth.accountId };
}
