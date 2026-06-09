import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import type { Tables } from "@/types/database.types";

export interface ValidatedStopChatWorkflowRequest {
  auth: AuthContext;
  chat: Tables<"chats">;
}

const chatIdSchema = z.string().uuid("chatId must be a valid UUID");

/** Validates POST /api/chat/{chatId}/stop: auth, chatId format, and chat + session-ownership lookup. */
export async function validateStopChatWorkflowRequest(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedStopChatWorkflowRequest> {
  const auth = await validateAuthContext(request);
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
