import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteTrailingChatMessagesHandler } from "@/lib/chats/deleteTrailingChatMessagesHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * DELETE /api/chats/[id]/messages/trailing
 *
 * Removes the selected message and every message that follows it in chat `id`, so the
 * conversation can be resumed from an earlier turn. The caller must own the chat or
 * have organization-level access; authentication uses `x-api-key` or
 * `Authorization: Bearer`.
 *
 * @param request - The incoming request. `from_message_id` is read from the JSON body
 *   and identifies the oldest message to delete (that message and all newer ones go).
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the chat UUID from the URL path.
 * @returns A 200 NextResponse with the count of deleted messages, 400 on a missing
 *   `from_message_id`, 401/403 when the caller cannot access the chat, or 404 when the
 *   chat or message does not exist.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return deleteTrailingChatMessagesHandler(request, id);
}
