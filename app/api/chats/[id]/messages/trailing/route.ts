import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteTrailingChatMessagesHandler } from "@/lib/chats/deleteTrailingChatMessagesHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * Handles DELETE requests.
 *
 * @param request - Incoming HTTP request.
 * @param root1 - Input object.
 * @param root1.params - Dynamic route parameters.
 * @returns - Computed result.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return deleteTrailingChatMessagesHandler(request, id);
}
