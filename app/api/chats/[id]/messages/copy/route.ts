import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { copyChatMessagesHandler } from "@/lib/chats/copyChatMessagesHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/chats/[id]/messages/copy
 *
 * Copies all messages from the source chat (`id`) to a target chat (`targetChatId` in body).
 *
 * @param request - The incoming request object.
 * @param root0 - Route context object.
 * @param root0.params - Dynamic route params containing source chat ID.
 * @returns A NextResponse with copy result or an error.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return copyChatMessagesHandler(request, id);
}
