import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteTrailingChatMessagesHandler } from "@/lib/chats/deleteTrailingChatMessagesHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * DELETE.
 *
 * @param request - Parameter.
 * @param root1 - Parameter.
 * @param root1.params - Parameter.
 * @returns - Result.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return deleteTrailingChatMessagesHandler(request, id);
}
