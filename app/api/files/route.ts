import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getFilesHandler } from "@/lib/files/getFilesHandler";

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
 * GET /api/files
 *
 * Lists files for an accessible artist account. Returns the matching file rows
 * along with the owner's primary email address when one exists.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with file rows or an error response.
 */
export async function GET(request: NextRequest) {
  return getFilesHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
