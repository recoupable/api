import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { persistAssistantMessageBodySchema } from "@/lib/sessions/chats/persistAssistantMessageSchemas";
import type { ValidatedPersistSessionChatAssistantMessageRequest } from "@/lib/sessions/chats/persistAssistantMessageTypes";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import type { Json } from "@/types/database.types";

/**
 * Validates `POST /api/sessions/{sessionId}/chats/{chatId}/messages`:
 *   1. Authenticates via Privy Bearer / `x-api-key` (`validateAuthContext`)
 *   2. Loads the session and confirms ownership (same shape as chat-create)
 *   3. Ensures `chatId` exists under `sessionId`
 *   4. Parses strict JSON then validates `{ message }` against the docs contract
 *
 * Malformed JSON → **400** `{ error: "Invalid JSON body" }`.
 * Validation failures → **400** `{ error: "A valid assistant message is required" }`.
 *
 * @param request - Incoming POST request (body consumed once).
 * @param sessionId - Parent session id from the path.
 * @param chatId - Chat id from the path.
 */
export async function validatePersistSessionChatAssistantMessageRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | ValidatedPersistSessionChatAssistantMessageRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rows = await selectSessions({ id: sessionId });
  const session = rows[0] ?? null;

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

  const chats = await selectChats({ id: chatId });
  const chat = chats[0] ?? null;
  if (!chat || chat.session_id !== sessionId) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json(
      { error: "A valid assistant message is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = persistAssistantMessageBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid assistant message is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    message: {
      id: parsed.data.message.id,
      role: parsed.data.message.role,
      parts: parsed.data.message.parts as Json,
    },
  };
}
