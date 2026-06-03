import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { internalServerErrorResponse } from "@/lib/networking/internalServerErrorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateWorkflowChatAccess } from "@/lib/chats/validateWorkflowChatAccess";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

const deleteTrailingQuerySchema = z.object({
  from_message_id: z.string().uuid("from_message_id must be a valid UUID"),
});

export interface ValidatedDeleteTrailingMessagesQuery {
  chatId: string;
  fromMessageId: string;
  boundary: {
    createdAt: string;
    id: string;
  };
}

/**
 * Validates DELETE /api/chats/[id]/messages/trailing query and chat/message ownership.
 *
 * @param request - Incoming request containing query parameters.
 * @param chatId - Workflow chat UUID from route params.
 * @returns Either an error response or a validated payload for deletion.
 */
export async function validateDeleteTrailingMessagesQuery(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse | ValidatedDeleteTrailingMessagesQuery> {
  const accessResult = await validateWorkflowChatAccess(request, chatId);
  if (accessResult instanceof NextResponse) {
    return accessResult;
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

  const messages = await selectChatMessages({
    chatId: accessResult.chatId,
    id: parsedQuery.data.from_message_id,
    limit: 1,
  });

  if (messages === null) {
    return internalServerErrorResponse();
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { status: "error", error: "Message not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const boundaryMessage = messages[0];

  return {
    chatId: accessResult.chatId,
    fromMessageId: parsedQuery.data.from_message_id,
    boundary: {
      createdAt: boundaryMessage.created_at,
      id: boundaryMessage.id,
    },
  };
}
