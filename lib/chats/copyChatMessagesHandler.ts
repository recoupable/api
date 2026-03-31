import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateUUID } from "@/lib/uuid/generateUUID";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import insertCopiedMemories from "@/lib/supabase/memories/insertCopiedMemories";
import deleteMemoriesByRoomId from "@/lib/supabase/memories/deleteMemoriesByRoomId";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";

/**
 * Handles POST /api/chats/[id]/messages/copy.
 *
 * Copies all messages from source chat (`id` path param) into target chat (`targetChatId` body field).
 */
export async function copyChatMessagesHandler(
  request: NextRequest,
  sourceChatId: string,
): Promise<NextResponse> {
  const validated = await validateCopyChatMessagesBody(request, sourceChatId);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { targetChatId, clearExisting } = validated;

  try {
    const sourceMemories = await selectMemories(sourceChatId, { ascending: true });
    if (!sourceMemories) {
      return NextResponse.json(
        { status: "error", error: "Failed to load source chat messages" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (clearExisting) {
      const deleted = await deleteMemoriesByRoomId(targetChatId);
      if (!deleted) {
        return NextResponse.json(
          { status: "error", error: "Failed to clear target chat messages" },
          { status: 500, headers: getCorsHeaders() },
        );
      }
    }

    const copiedCount = await insertCopiedMemories(
      sourceMemories.map(memory => ({
        id: generateUUID(),
        room_id: targetChatId,
        content: memory.content,
        updated_at: memory.updated_at,
      })),
    );

    return NextResponse.json(
      {
        status: "success",
        source_chat_id: sourceChatId,
        target_chat_id: targetChatId,
        copied_count: copiedCount,
        cleared_existing: clearExisting,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
