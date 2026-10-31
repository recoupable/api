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
 * Deletes the selected Workflow chat message and its inclusive suffix ordered by
 * created_at, id. Uses current Workflow ownership (including authorized account
 * overrides); no legacy memories are read or deleted. Any observed occupied
 * workflow slot returns 409, but a null slot is not proof of writer drainage.
 *
 * Caller precondition: no concurrent or outstanding message writers. Concurrent
 * edit/resend is unsupported. Success means the DELETE statement succeeded,
 * possibly affecting zero rows; it does not promise durable absence. On failure,
 * refresh history before deciding further action rather than blindly resending.
 *
 * @param request - Authenticated request with UUID `from_message_id` in the query.
 * @param context - Route context.
 * @param context.params - Promise resolving to the `{ id }` chat UUID.
 * @returns 200 `{status:"success",chat_id,from_message_id}`; 400 invalid query;
 *   401/403 access denied; 404 missing chat/anchor; 409 occupied workflow slot;
 *   500 read, stored-coordinate or delete failure. Transport failure may leave
 *   the commit outcome unknown.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return deleteTrailingChatMessagesHandler(request, id);
}
