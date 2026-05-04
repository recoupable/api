import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";
import { failedToCreateSession } from "@/lib/sessions/failedToCreateSession";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";
import { toChatResponse } from "@/lib/sessions/toChatResponse";

const INITIAL_CHAT_TITLE = "New chat";

/**
 * Handles `POST /api/sessions`.
 *
 * Authenticates the caller, validates the optional request body, then
 * creates a session row and an initial chat row. If the chat insert
 * fails after the session row is persisted, the session is rolled
 * back so callers never observe an orphaned session.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ session, chat }` on 200, or an error.
 */
export async function createSessionHandler(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await safeParseJson(request);
  const validated = validateCreateSessionBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const sessionRow = await insertSession(
    buildSessionInsertRow({ body: validated, accountId: auth.accountId }),
  );

  if (!sessionRow) {
    return failedToCreateSession();
  }

  const chatRow = await insertChat({
    id: generateUUID(),
    session_id: sessionRow.id,
    title: INITIAL_CHAT_TITLE,
  });

  if (!chatRow) {
    await deleteSessionById(sessionRow.id);
    return failedToCreateSession();
  }

  return NextResponse.json(
    { session: toSessionResponse(sessionRow), chat: toChatResponse(chatRow) },
    { status: 200, headers: getCorsHeaders() },
  );
}
