import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getChatMessagesHandler } from "@/lib/chats/getChatMessagesHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns Empty response with CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/chats/[id]/messages
 *
 * Returns memories (messages) for a chat in chronological order.
 *
 * @param request - Incoming request.
 * @param context - Next.js route context.
 * @param context.params - Async route params containing chat id.
 * @returns JSON response with chat messages.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { params } = context;
  const { id } = await params;
  return getChatMessagesHandler(request, id);
}
