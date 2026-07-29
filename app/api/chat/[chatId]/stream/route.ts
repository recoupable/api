import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatStreamResume } from "@/lib/chat/handleChatStreamResume";

export const maxDuration = 800;

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
 * GET /api/chat/[chatId]/stream
 *
 * Resume/reconnect endpoint for the durable chat-workflow agent loop. Returns
 * the live UIMessage stream when a run is still in flight, or 204 when there
 * is nothing to resume. This is the only resume path — POST /api/chat/workflow
 * never resumes.
 *
 * Authentication: x-api-key or Authorization bearer (caller must own the chat).
 *
 * @param request - The incoming request.
 * @param context - Next.js route context.
 * @param context.params - Async route params containing the chat id.
 * @returns A streaming Response (200), an empty 204, or an error response.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await context.params;
  return handleChatStreamResume(request, chatId);
}
