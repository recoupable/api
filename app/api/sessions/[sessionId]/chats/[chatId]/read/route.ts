import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { markChatReadHandler } from "@/lib/sessions/chats/markChatReadHandler";

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
 * POST /api/sessions/{sessionId}/chats/{chatId}/read
 *
 * Marks a chat as read for the authenticated account. Authenticates via
 * Privy Bearer token or x-api-key header.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing sessionId and chatId.
 * @returns A NextResponse with `{ success: true }` on 200, or an error.
 */
export async function POST(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string; chatId: string }> },
) {
  const { sessionId, chatId } = await options.params;
  return markChatReadHandler(request, sessionId, chatId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
