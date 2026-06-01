import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createChatHandler } from "@/lib/chats/createChatHandler";
import { getChatsHandler } from "@/lib/chats/getChatsHandler";
import { updateChatHandler } from "@/lib/chats/updateChatHandler";
import { deleteChatHandler } from "@/lib/chats/deleteChatHandler";

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
 * GET /api/chats
 *
 * Retrieves chats joined with their owning session. Each row carries
 * `sessionId` and the owning `accountId` so clients can render canonical
 * `/sessions/{sessionId}/chats/{chatId}` URLs.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Query parameters:
 * - account_id (optional): UUID of the target account (validated for access).
 * - artist_account_id (optional): Accepted for backward compatibility but
 *   ignored — reserved for the artist-surface migration.
 *
 * @param request - The request object containing query parameters
 * @returns A NextResponse with chats data or an error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getChatsHandler(request);
}

/**
 * POST /api/chats
 *
 * Create a new chat room.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 * The account ID is inferred from the authenticated context.
 *
 * Optional body parameters:
 * - artistId: UUID of the artist account the chat is associated with
 * - chatId: UUID for the new chat (auto-generated if not provided)
 * - accountId: Optional account override if the authenticated account can access it
 *
 * @param request - The request object
 * @returns A NextResponse with the created chat or an error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createChatHandler(request);
}

/**
 * PATCH /api/chats
 *
 * Update a chat room's topic (display name).
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Body parameters:
 * - chatId (required): UUID of the chat room to update
 * - topic (required): New display name for the chat (3-50 characters)
 *
 * @param request - The request object
 * @returns A NextResponse with the updated chat or an error
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateChatHandler(request);
}

/**
 * DELETE /api/chats
 *
 * Delete a chat room and related records.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Body parameters:
 * - id (required): UUID of the chat room to delete
 *
 * @param request - The request object
 * @returns A NextResponse with deletion result or an error
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return deleteChatHandler(request);
}
