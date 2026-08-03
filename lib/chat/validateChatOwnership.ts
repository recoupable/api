import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import type { Tables } from "@/types/database.types";

export interface ValidatedChatOwnership {
  auth: AuthContext;
  chat: Tables<"chats">;
}

const chatIdSchema = z.string().uuid("chatId must be a valid UUID");

/**
 * Authenticate the caller and confirm they own the chat behind a
 * `/api/chat/{chatId}/…` route.
 *
 * Shared by `POST /api/chat/{chatId}/stop` and
 * `GET /api/chat/{chatId}/stream` so both enforce identical auth,
 * chat-id validation and ownership semantics.
 *
 * Honours the `account_id` **query** override, so an org/admin key can act
 * on a member account's chat. Both routes carry their id in the path and
 * parse no body, so a query param is the channel that works for `GET` and
 * `POST` alike without consuming the request body. `validateAuthContext` is
 * what decides whether the caller may actually use the override — passing it
 * through does not weaken the check, and omitting it was why an admin key got
 * a 403 on a chat it legitimately administers (same gap as `DELETE
 * /api/tasks`, chat#1918).
 *
 * @param request - The incoming request, carrying the credentials.
 * @param chatId - Chat id from the route params.
 * @returns The auth context + chat row, or an error response
 *   (400 malformed id, 401 unauthenticated, 403 not owned, 404 missing).
 */
export async function validateChatOwnership(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedChatOwnership> {
  const accountIdOverride = new URL(request.url).searchParams.get("account_id") ?? undefined;
  const auth = await validateAuthContext(request, { accountId: accountIdOverride });
  if (auth instanceof NextResponse) return auth;

  const parsed = chatIdSchema.safeParse(chatId);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const chats = await selectChats({ id: parsed.data });
  const chat = chats[0];
  if (!chat) return errorResponse("Chat not found", 404);

  const sessions = await selectSessions({ id: chat.session_id });
  if (sessions === null) return errorResponse("Internal server error", 500);
  const session = sessions[0];
  if (!session) return errorResponse("Chat not found", 404);
  if (session.account_id !== auth.accountId) return errorResponse("Forbidden", 403);

  return { auth, chat };
}
