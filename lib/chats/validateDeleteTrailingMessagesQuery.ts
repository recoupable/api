import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";
import selectMemories from "@/lib/supabase/memories/selectMemories";

const deleteTrailingQuerySchema = z.object({
  from_message_id: z.string().uuid("from_message_id must be a valid UUID"),
});

export interface ValidatedDeleteTrailingMessagesQuery {
  chatId: string;
  fromMessageId: string;
  fromCreatedAt: string;
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
  const roomResult = await validateChatAccess(request, chatId);
  if (roomResult instanceof NextResponse) {
    return roomResult;
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

  const [memory] =
    (await selectMemories(roomResult.room.id, {
      memoryId: parsedQuery.data.from_message_id,
      limit: 1,
    })) ?? [];
  if (!memory) {
    return NextResponse.json(
      { status: "error", error: "Message not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (!memory.created_at) {
    return NextResponse.json(
      { status: "error", error: "Message created_at not found" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return {
    chatId: roomResult.room.id,
    fromMessageId: parsedQuery.data.from_message_id,
    fromCreatedAt: memory.created_at,
  };
}
