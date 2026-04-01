import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getChatSegmentHandler } from "@/lib/chats/getChatSegmentHandler";

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
 * GET /api/chats/[id]/segment
 *
 * Retrieves the segment associated with a chat room.
 * Returns 404 when the room does not exist or is not accessible by the caller.
 *
 * @param request - The incoming request object.
 * @param root0 - The route context object.
 * @param root0.params - The dynamic route params containing chat id.
 * @returns A NextResponse with segment linkage data or an error.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return getChatSegmentHandler(request, id);
}
