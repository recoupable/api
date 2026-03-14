import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogSongsHandler } from "@/lib/songs/getCatalogSongsHandler";
import { createCatalogSongsHandler } from "@/lib/songs/createCatalogSongsHandler";
import { deleteCatalogSongsHandler } from "@/lib/songs/deleteCatalogSongsHandler";

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
 * GET handler for retrieving catalog songs with pagination.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with songs and pagination metadata.
 */
export async function GET(request: NextRequest) {
  return getCatalogSongsHandler(request);
}

/**
 * POST handler for creating catalog-song relationships.
 *
 * @param request - The request object containing the songs array in the body.
 * @returns A NextResponse with the created catalog songs.
 */
export async function POST(request: NextRequest) {
  return createCatalogSongsHandler(request);
}

/**
 * DELETE handler for deleting catalog-song relationships.
 *
 * @param request - The request object containing the songs array in the body.
 * @returns A NextResponse with the remaining catalog songs.
 */
export async function DELETE(request: NextRequest) {
  return deleteCatalogSongsHandler(request);
}
