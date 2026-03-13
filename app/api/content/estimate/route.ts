import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentEstimateHandler } from "@/lib/content/getContentEstimateHandler";

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
 * GET /api/content/estimate
 *
 * Returns estimated content-creation costs.
 *
 * @param request - Incoming API request.
 * @returns Cost estimate response.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getContentEstimateHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

