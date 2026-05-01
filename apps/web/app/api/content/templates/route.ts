import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentTemplatesHandler } from "@/lib/content/getContentTemplatesHandler";

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
 * GET /api/content/templates
 *
 * Lists available templates for the content-creation pipeline.
 *
 * @param request - Incoming API request.
 * @returns Template list response.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getContentTemplatesHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
