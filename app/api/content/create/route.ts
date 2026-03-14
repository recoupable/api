import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createContentHandler } from "@/lib/content/createContentHandler";

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
 * POST /api/content/create
 *
 * Triggers the background content-creation pipeline and returns a run ID.
 *
 * @param request - Incoming API request.
 * @returns Trigger response for the created task run.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createContentHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
