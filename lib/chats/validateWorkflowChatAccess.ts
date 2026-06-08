import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export interface ValidatedWorkflowChatAccess {
  chatId: string;
  chat: Tables<"chats">;
  accountId: string;
}

const chatIdSchema = z.string().uuid("id must be a valid UUID");

/**
 * Validates that the authenticated caller can access a workflow chat row.
 *
 * @param request - The incoming request used for auth context.
 * @param chatId - The workflow chat UUID to validate access for.
 * @returns NextResponse on auth/access failure, or validated access data.
 */
export async function validateWorkflowChatAccess(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedWorkflowChatAccess> {
  const chatIdResult = chatIdSchema.safeParse(chatId);
  if (!chatIdResult.success) {
    return NextResponse.json(
      { status: "error", error: chatIdResult.error.issues[0]?.message || "Invalid chat ID" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const chatRows = (await selectChats({ id: chatIdResult.data })) ?? [];
  const chat = chatRows[0] ?? null;
  if (!chat) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const sessionRows = await selectSessions({ id: chat.session_id });
  if (sessionRows === null) {
    return errorResponse("Internal server error", 500);
  }
  const session = sessionRows[0] ?? null;
  if (!session) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (session.account_id !== authResult.accountId) {
    return NextResponse.json(
      { status: "error", error: "Access denied to this chat" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return { chatId: chat.id, chat, accountId: authResult.accountId };
}
