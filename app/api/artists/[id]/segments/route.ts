import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postArtistSegmentsHandler } from "@/lib/artists/segments/postArtistSegmentsHandler";

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
 * POST /api/artists/{id}/segments
 *
 * Manually creates segments for the specified artist by delegating to the shared
 * `createSegments` handler (also exposed via the MCP `create_segments` tool).
 *
 * @param request - The incoming request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with the segment creation envelope
 */
export async function POST(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return postArtistSegmentsHandler(request, options.params);
}
