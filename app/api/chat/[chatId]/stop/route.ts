import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleStopChatWorkflow } from "@/lib/chat/handleStopChatWorkflow";

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
 * POST /api/chat/{chatId}/stop — stop the in-progress response for a chat.
 *
 * @param request - The incoming NextRequest.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the chat id.
 * @returns A NextResponse with `{ success, stopped }` on 200, or an error.
 */
export async function POST(
  request: NextRequest,
  options: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await options.params;
  return handleStopChatWorkflow(request, chatId);
}
