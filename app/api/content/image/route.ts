import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createImageHandler } from "@/lib/content/image/createImageHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/image
 *
 * Generate an image from a prompt and optional reference image.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createImageHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
