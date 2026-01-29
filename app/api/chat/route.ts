import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAuth } from "@/lib/chat/validateChatAuth";
import { x402Chat } from "@/lib/x402/recoup/x402Chat";

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
 * All requests are routed through the x402 payment system, which:
 * 1. Deducts credits from the account
 * 2. Makes an on-chain USDC payment
 * 3. Forwards to the x402-protected chat endpoint
 *
 * Authentication: x-api-key or Authorization header required.
 * The account ID is inferred from the authentication.
 *
 * Request body:
 * - messages: Array of chat messages (mutually exclusive with prompt)
 * - prompt: String prompt (mutually exclusive with messages)
 * - roomId: Optional UUID of the chat room
 * - artistId: Optional UUID of the artist account
 * - model: Optional model ID override
 * - excludeTools: Optional array of tool names to exclude
 * - accountId: Optional accountId override (requires org API key)
 *
 * @param request - The request object
 * @returns A streaming response or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  // Validate authentication and get accountId
  const authResult = await validateChatAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { body, accountId, orgId } = authResult;

  try {
    // Build the chat body with resolved accountId
    const chatBody = {
      ...body,
      accountId,
      orgId,
      messages: body.messages || [],
    };

    // Get the base URL for the x402 endpoint
    const baseUrl = request.nextUrl.origin;

    // Route through x402 endpoint (handles credit deduction and payment)
    const response = await x402Chat(chatBody, baseUrl);

    // Filter out CORS headers from internal response to avoid duplicates
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const filteredHeaders = Object.fromEntries(
      Object.entries(responseHeaders).filter(
        ([key]) => !key.toLowerCase().startsWith("access-control-"),
      ),
    );

    // Return the streaming response with our CORS headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...filteredHeaders,
        ...getCorsHeaders(),
      },
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        status: "error",
        message: errorMessage,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
