import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";
import { buildChatMessageTrailingDeleteFilter } from "@/lib/supabase/chat_messages/buildChatMessageTrailingDeleteFilter";
import type { ChatMessageTrailingBoundary } from "@/lib/supabase/chat_messages/ChatMessageTrailingBoundary";
import { errorResponse } from "@/lib/networking/errorResponse";

const deleteTrailingQuerySchema = z.object({
  from_message_id: z.string().uuid("from_message_id must be a valid UUID"),
});

export interface ValidatedDeleteTrailingMessagesQuery extends ChatMessageTrailingBoundary {
  chatId: string;
}

/**
 * Validates DELETE /api/chats/[id]/messages/trailing query and chat/message ownership.
 *
 * @param request - Incoming request containing query parameters.
 * @param chatId - Chat UUID from route params.
 * @returns Either an error response or a validated payload for deletion.
 */
export async function validateDeleteTrailingMessagesQuery(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedDeleteTrailingMessagesQuery> {
  const ownership = await validateChatOwnership(request, chatId);
  if (ownership instanceof NextResponse) {
    return ownership;
  }

  const parsedQuery = deleteTrailingQuerySchema.safeParse({
    from_message_id: request.nextUrl.searchParams.get("from_message_id") ?? undefined,
  });

  if (!parsedQuery.success) {
    const firstError = parsedQuery.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (ownership.chat.active_stream_id !== null) {
    return errorResponse("Chat has an active workflow reservation; retry after it clears", 409);
  }

  const messages = await selectChatMessages({
    chatId: ownership.chat.id,
    id: parsedQuery.data.from_message_id,
    limit: 1,
  });
  if (messages === null) return errorResponse("Failed to load messages", 500);
  const message = messages[0];
  if (!message) return errorResponse("Message not found", 404);

  const boundary = { fromMessageId: message.id, fromTimestamp: message.created_at };
  try {
    buildChatMessageTrailingDeleteFilter(boundary);
  } catch {
    return errorResponse("Invalid message boundary", 500);
  }

  return { chatId: ownership.chat.id, ...boundary };
}
