import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSessionChatsHandler } from "@/lib/sessions/chats/getSessionChatsHandler";
import { createSessionChatHandler } from "@/lib/sessions/chats/createSessionChatHandler";

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
 * Lists every chat that belongs to the session, plus the caller's
 * default model id. Authenticates via Privy Bearer token or
 * `x-api-key`; 404s when the session is missing and 403s when it
 * exists but is owned by a different account.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the session id.
 * @returns A NextResponse with `{ chats, defaultModelId }` on 200, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await options.params;
  return getSessionChatsHandler(request, sessionId);
}

/**
 * POST /api/sessions/{sessionId}/chats
 *
 * Creates a new chat in the session. Callers may pass `{ id }` to
 * claim a deterministic chat id; the call is idempotent when the id
 * already belongs to the same session, and 409s when it belongs to a
 * different session.
 *
 * @param request - The incoming request.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the session id.
 * @returns A NextResponse with `{ chat }` on 200, or an error.
 */
export async function POST(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await options.params;
  return createSessionChatHandler(request, sessionId);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
