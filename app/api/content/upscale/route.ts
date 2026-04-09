import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createUpscaleHandler } from "@/lib/content/primitives/createUpscaleHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/upscale
 *
 * Upscale an image or video to higher resolution.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createUpscaleHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
