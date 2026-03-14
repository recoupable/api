import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { compactChatsHandler } from "@/lib/chats/compactChatsHandler";

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
 * POST /api/chats/compact
 *
 * Compact one or more chat conversations into summarized versions.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - chatId (required): Array of UUIDs - the conversations to compact
 * - prompt (optional): String to guide which details are retained
 *
 * Response:
 * - 200: { chats: [{ chatId: string, compacted: string }] }
 * - 400: Invalid parameters
 * - 401: Missing or invalid API key
 * - 404: One or more chat IDs don't exist
 *
 * @param request - The request object
 * @returns A NextResponse with the compacted chats or an error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return compactChatsHandler(request);
}
