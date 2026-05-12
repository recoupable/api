import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { APP_DEFAULT_MODEL_ID } from "@/lib/const";
import { validateGetSessionChatsRequest } from "@/lib/sessions/validateGetSessionChatsRequest";
import { getChatSummaries } from "@/lib/supabase/chats/getChatSummaries";

/**
 * Handles `GET /api/sessions/{sessionId}/chats`. Lists chats in the
 * session as camelCase summaries with per-account unread state, plus
 * the caller's default model id.
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

  const chats = await getChatSummaries({
    sessionId,
    accountId: validated.auth.accountId,
  });

  return NextResponse.json(
    { chats, defaultModelId: APP_DEFAULT_MODEL_ID },
    { status: 200, headers: getCorsHeaders() },
  );
}
