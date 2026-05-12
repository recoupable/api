import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { APP_DEFAULT_MODEL_ID } from "@/lib/const";
import { validateGetSessionChatsRequest } from "@/lib/sessions/validateGetSessionChatsRequest";
import { getChatSummariesBySessionId } from "@/lib/supabase/chats/getChatSummariesBySessionId";

/**
 * Handles `GET /api/sessions/{sessionId}/chats`.
 *
 * Lists every chat in the session as a camelCase `ChatSummary`,
 * plus the caller's default model id. Per-chat unread state is
 * derived from the caller's `chat_reads` row. Response shape
 * mirrors open-agents' `/api/sessions/[sessionId]/chats` so the
 * existing frontend can cut over without code changes.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @returns A NextResponse with `{ chats, defaultModelId }` on 200, or an error.
 */
export async function getSessionChatsHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const validated = await validateGetSessionChatsRequest(request, sessionId);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const chats = await getChatSummariesBySessionId({
    sessionId,
    accountId: validated.auth.accountId,
  });

  return NextResponse.json(
    { chats, defaultModelId: APP_DEFAULT_MODEL_ID },
    { status: 200, headers: getCorsHeaders() },
  );
}
