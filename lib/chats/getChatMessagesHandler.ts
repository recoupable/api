import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetChatMessagesQuery } from "@/lib/chats/validateGetChatMessagesQuery";
import selectMemories from "@/lib/supabase/memories/selectMemories";

/**
 * Handles GET /api/chats/[id]/messages.
 *
 * Returns all messages for a chat in ascending order by `updated_at`.
 *
 * @param request - Incoming request used to validate chat access.
 * @param id - Chat identifier from route params.
 * @returns JSON response containing ordered chat messages.
 */
export async function getChatMessagesHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetChatMessagesQuery(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const memories = await selectMemories(validated.room.id, { ascending: true });
    if (memories === null) {
      return NextResponse.json(
        { status: "error", error: "Failed to retrieve memories" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { data: memories },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Unexpected error in getChatMessagesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to retrieve memories" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
