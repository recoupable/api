import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatRunStatus } from "@/lib/chat/generate/handleChatRunStatus";

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
 * GET /api/chat/runs/{runId}
 *
 * Point-in-time status of an asynchronous run started via `POST /api/chat/runs`
 * (recoupable/chat#1813). Returns `{ runId, status }` — a snapshot ("is it
 * done?"), not the generated content. Read the content via the chat (`chatId`
 * from the start response): `GET /api/chat/{chatId}/stream`, or the persisted
 * messages.
 *
 * Authentication: x-api-key header required.
 *
 * @param request - The request object.
 * @param ctx - Route context with the `runId` path param.
 * @param ctx.params - Promise resolving to the `{ runId }` path params.
 * @returns 200 `{ runId, status }`, 401/403 on auth, or 404 if the run is unknown.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await ctx.params;
  return handleChatRunStatus(request, runId);
}

export const dynamic = "force-dynamic";
