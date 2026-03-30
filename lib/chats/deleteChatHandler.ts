import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteChatBody } from "./validateDeleteChatBody";
import { deleteRoomWithRelations } from "@/lib/supabase/rooms/deleteRoomWithRelations";

/**
 * Handles DELETE /api/chats - Delete a chat room and related records.
 *
 * @param request - The NextRequest object
 * @returns NextResponse with deletion result or error
 */
export async function deleteChatHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateDeleteChatBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { chatId } = validated;

  try {
    const deleted = await deleteRoomWithRelations(chatId);

    if (!deleted) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete chat" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        chatId,
        message: "Chat deleted successfully",
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
