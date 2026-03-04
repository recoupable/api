import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentValidateHandler } from "@/lib/content/getContentValidateHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns Empty 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/content/validate
 *
 * Validates whether an artist is ready for content creation.
 *
 * @param request - Incoming API request.
 * @returns Artist readiness response.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getContentValidateHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

