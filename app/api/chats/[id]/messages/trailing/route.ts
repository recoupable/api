import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteTrailingChatMessagesHandler } from "@/lib/chats/deleteTrailingChatMessagesHandler";

/**
 * OPTIONS handler for CORS preflight requests.
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
 * Deletes all messages in chat `id` from `from_message_id` onward.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return deleteTrailingChatMessagesHandler(request, id);
}
