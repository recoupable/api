import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleResumeChatStream } from "@/lib/chat/handleResumeChatStream";

// Matches POST /api/chat: a resumed stream stays open as long as the turn it
// is following, so it needs the same ceiling rather than the route default.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

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
 * GET /api/chat/{chatId}/stream — reconnect to an in-progress chat response.
 *
 * The resume counterpart to `POST /api/chat`, which only resumes as a side
 * effect of starting a turn. Pass `startIndex` to continue from the chunk
 * after the last one received; omit it to read the response from the start.
 *
 * Contract: https://docs.recoupable.dev/api-reference/chat/workflow-stream
 *
 * @param request - The incoming NextRequest.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the chat id.
 * @returns A streaming 200, 204 when there is nothing to resume, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await options.params;
  return handleResumeChatStream(request, chatId);
}
