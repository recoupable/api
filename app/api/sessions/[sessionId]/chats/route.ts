import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { listSessionChatsHandler } from "@/lib/sessions/listSessionChatsHandler";

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
 * GET /api/sessions/{sessionId}/chats
 *
 * Lists chats for the session with unread/streaming flags. Requires the
 * authenticated account to own the session.
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
