import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createArtistPostHandler } from "@/lib/artists/createArtistPostHandler";

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
 * POST /api/artist
 *
 * Creates a new artist account and associates it with an owner account.
 *
 * JSON body:
 * - name (required): The name of the artist to create
 * - account_id (required): The ID of the owner account (UUID)
 *
 * @param request - The request object containing JSON body
 * @returns A NextResponse with the created artist data
 */
export async function POST(request: NextRequest) {
  return createArtistPostHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
