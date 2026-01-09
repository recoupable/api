import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createChatHandler } from "@/lib/chats/createChatHandler";

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
 * POST /api/chats
 *
 * Create a new chat room.
 *
 * Authentication: x-api-key header required.
 * The account ID is inferred from the API key.
 *
 * Optional body parameters:
 * - artistId: UUID of the artist account the chat is associated with
 * - chatId: UUID for the new chat (auto-generated if not provided)
 *
 * @param request - The request object
 * @returns A NextResponse with the created chat or an error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createChatHandler(request);
}
