import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL } from "@/lib/const";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectChatReadsByAccountAndChatIds } from "@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { toChatSummary } from "@/lib/sessions/toChatSummary";

/**
 * Handles GET /api/sessions/{sessionId}/chats.
 *
 * Authenticates, verifies session ownership, then returns chats with
 * per-account `hasUnread` / `isStreaming` and a `defaultModelId` for new chats.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @returns A NextResponse with `{ chats, defaultModelId }` on 200, or an error.
 */
export async function listSessionChatsHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessionRows = await selectSessions({ id: sessionId });
  const sessionRow = sessionRows[0] ?? null;

  if (!sessionRow) {
    return NextResponse.json(
      { status: "error", error: "Session not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (sessionRow.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  const chatRows = await selectChats({
    sessionId,
    orderCreatedAtAscending: true,
  });

  const chatIds = chatRows.map(c => c.id);
  const readRows = await selectChatReadsByAccountAndChatIds(auth.accountId, chatIds);
  const lastReadByChatId = new Map(readRows.map(r => [r.chat_id, r.last_read_at]));

  const chats = chatRows.map(row => toChatSummary(row, lastReadByChatId.get(row.id) ?? null));

  return NextResponse.json(
    { chats, defaultModelId: DEFAULT_MODEL },
    { status: 200, headers: getCorsHeaders() },
  );
}
