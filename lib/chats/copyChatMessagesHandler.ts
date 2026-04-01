import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateUUID } from "@/lib/uuid/generateUUID";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import deleteMemories from "@/lib/supabase/memories/deleteMemories";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";

/**
 * Handles POST /api/chats/[id]/messages/copy.
 *
 * Copies all messages from source chat (`id` path param) into target chat (`targetChatId` body field).
 *
 * @param request - Incoming request object.
 * @param sourceChatId - Source chat UUID from route params.
 * @returns JSON response containing copy result or error.
 */
export async function copyChatMessagesHandler(
  request: NextRequest,
  sourceChatId: string,
): Promise<NextResponse> {
  try {
    const validated = await validateCopyChatMessagesBody(request, sourceChatId);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const [sourceAccess, targetAccess] = await Promise.all([
      validateChatAccess(request, sourceChatId),
      validateChatAccess(request, validated.targetChatId),
    ]);
    if (sourceAccess instanceof NextResponse) return sourceAccess;
    if (targetAccess instanceof NextResponse) return targetAccess;

    const accessibleSourceChatId = sourceAccess.roomId;
    const accessibleTargetChatId = targetAccess.roomId;

    const { clearExisting } = validated;

    const sourceMemories = await selectMemories(accessibleSourceChatId, { ascending: true });
    if (!sourceMemories) {
      return NextResponse.json(
        { status: "error", error: "Failed to load source chat messages" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (clearExisting) {
      const deleted = await deleteMemories(accessibleTargetChatId);
      if (!deleted) {
        return NextResponse.json(
          { status: "error", error: "Failed to clear target chat messages" },
          { status: 500, headers: getCorsHeaders() },
        );
      }
    }

    const copiedCount = await insertMemories(
      sourceMemories.map(memory => ({
        id: generateUUID(),
        room_id: accessibleTargetChatId,
        content: memory.content,
        updated_at: memory.updated_at,
      })),
    );

    return NextResponse.json(
      {
        status: "success",
        source_chat_id: accessibleSourceChatId,
        target_chat_id: accessibleTargetChatId,
        copied_count: copiedCount,
        cleared_existing: clearExisting,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Unexpected error in copyChatMessagesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to copy chat messages" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
