import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePatchSessionChatRequest } from "@/lib/sessions/chats/validatePatchSessionChatRequest";
import { updateChat } from "@/lib/supabase/chats/updateChat";

/**
 * Handles `PATCH /api/sessions/{sessionId}/chats/{chatId}`. Applies a
 * partial update to the chat (`title` and/or `modelId`) and returns
 * the updated row under `{ chat }`.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being updated.
 * @returns A NextResponse with `{ chat }` on 200, or an error.
 */
export async function patchSessionChatHandler(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse> {
  const validated = await validatePatchSessionChatRequest(request, sessionId, chatId);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const updated = await updateChat({
    chatId,
    patch: {
      ...(validated.patch.title !== undefined && { title: validated.patch.title }),
      ...(validated.patch.modelId !== undefined && { model_id: validated.patch.modelId }),
    },
  });

  if (!updated) {
    return NextResponse.json(
      { status: "error", error: "Failed to update chat" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json({ chat: updated }, { status: 200, headers: getCorsHeaders() });
}
