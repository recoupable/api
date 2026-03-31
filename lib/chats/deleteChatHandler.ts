import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteChatBody } from "@/lib/chats/validateDeleteChatBody";
import { deleteRoom } from "@/lib/supabase/rooms/deleteRoom";

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

  const { id } = validated;

  try {
    const deleted = await deleteRoom(id);

    if (!deleted) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete chat" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        id,
        message: "Chat deleted successfully",
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error("[ERROR] deleteChatHandler:", error.message);
    }
    return NextResponse.json(
      { status: "error", error: "Server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
