import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { APP_DEFAULT_MODEL_ID } from "@/lib/const";
import { requireOwnedSession } from "@/lib/sessions/requireOwnedSession";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectChatReads } from "@/lib/supabase/chat_reads/selectChatReads";
import { toChatSummaryResponse } from "@/lib/sessions/toChatSummaryResponse";

/**
 * Handles `GET /api/sessions/{sessionId}/chats`.
 *
 * Authenticates the caller, verifies they own the session, then
 * returns every chat in the session plus the caller's default model
 * id. Per-chat unread state is derived from the caller's `chat_reads`
 * row (if any). Response shape mirrors open-agents'
 * `/api/sessions/[sessionId]/chats` so the existing frontend can cut
 * over without code changes.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @returns A NextResponse with `{ chats, defaultModelId }` on 200, or an error.
 */
export async function getSessionChatsHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const gate = await requireOwnedSession(request, sessionId);
  if (gate instanceof NextResponse) {
    return gate;
  }

  const chats = await selectChats({ sessionId });
  const reads =
    chats.length > 0
      ? await selectChatReads({
          accountId: gate.auth.accountId,
          chatIds: chats.map(row => row.id),
        })
      : [];

  const lastReadByChatId = new Map<string, string>();
  for (const read of reads) {
    lastReadByChatId.set(read.chat_id, read.last_read_at);
  }

  const sorted = [...chats].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return NextResponse.json(
    {
      chats: sorted.map(row => toChatSummaryResponse(row, lastReadByChatId.get(row.id) ?? null)),
      defaultModelId: APP_DEFAULT_MODEL_ID,
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
