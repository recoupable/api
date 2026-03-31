import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import deleteMemoriesByRoomIdAfterTimestamp from "@/lib/supabase/memories/deleteMemoriesByRoomIdAfterTimestamp";

/**
 * Handles DELETE /api/chats/[id]/messages/trailing.
 */
export async function deleteTrailingChatMessagesHandler(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse> {
  const validated = await validateDeleteTrailingMessagesQuery(request, chatId);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const deletedCount = await deleteMemoriesByRoomIdAfterTimestamp(
    validated.chatId,
    validated.fromTimestamp,
  );

  if (deletedCount === null) {
    return NextResponse.json(
      { status: "error", error: "Failed to delete trailing messages" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    {
      status: "success",
      chat_id: validated.chatId,
      from_message_id: validated.fromMessageId,
      deleted_count: deletedCount,
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
