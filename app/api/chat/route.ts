import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatStream } from "@/lib/chat/handleChatStream";

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
 * POST /api/chat
 *
 * Streaming chat endpoint that processes messages and returns a streaming response.
 *
 * Authentication: x-api-key header required.
 * The account ID is inferred from the API key.
 *
 * Request body:
 * - messages: Array of chat messages (mutually exclusive with prompt)
 * - prompt: String prompt (mutually exclusive with messages)
 * - roomId: Optional UUID of the chat room
 * - topic: Optional topic for new chat room (ignored if room already exists)
 * - artistId: Optional UUID of the artist account
 * - model: Optional model ID override
 * - excludeTools: Optional array of tool names to exclude
 * - accountId: Optional accountId override (requires org API key)
 *
 * @param request - The request object
 * @returns A streaming response or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleChatStream(request);
}
