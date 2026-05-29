import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getChatHandler } from "@/lib/chats/getChatHandler";

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
 * GET /api/chats/[id]
 *
 * Returns the chat row in camelCase wire format (incl. `sessionId`) for
 * the authenticated owner of its parent session.
 *
 * @param request - Incoming request.
 * @param context - Next.js route context.
 * @param context.params - Async route params containing the chat id.
 * @returns JSON response with `{ chat }`, or a 401/403/404 error.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { params } = context;
  const { id } = await params;
  return getChatHandler(request, id);
}
