import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleChatStreamX402 } from "@/lib/chat/handleChatStreamX402";

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
 * POST /api/x402/chat
 *
 * x402-protected streaming chat endpoint. Payment is verified by the x402 middleware
 * before this handler is called. The accountId is passed in the request body and
 * trusted because the caller paid via x402.
 *
 * Request body:
 * - messages: Array of chat messages (mutually exclusive with prompt)
 * - prompt: String prompt (mutually exclusive with messages)
 * - roomId: Optional UUID of the chat room
 * - artistId: Optional UUID of the artist account
 * - accountId: The account ID of the user making the request
 * - model: Optional model ID override
 * - excludeTools: Optional array of tool names to exclude
 *
 * @param request - The request object
 * @returns A streaming response or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleChatStreamX402(request);
}
