import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listSessionChatsHandler } from "@/lib/sessions/listSessionChatsHandler";

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
 * GET /api/sessions/{sessionId}/chats
 *
 * Lists chats for the session with unread/streaming flags. Requires the
 * authenticated account to own the session.
 *
 * @param request - The request object
 * @param options - Route options containing the async params
 * @param options.params - Route params containing the session id
 * @returns A NextResponse with `{ chats, defaultModelId }` on 200, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await options.params;
  return listSessionChatsHandler(request, sessionId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
