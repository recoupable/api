import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createVideoHandler } from "@/lib/content/video/createVideoHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/video
 *
 * Generates a house-model video from a prompt and optional first/last images. Body
 * is validated by `validateCreateVideoBody` in `lib/content/video/`.
 *
 * @param request - JSON body with prompt, optional image_url/end_image_url,
 *   integer duration and resolution (see validateCreateVideoBody for the schema).
 * @returns A 200 NextResponse with the generated video URL and related metadata,
 *   400 on a bad body, 502 when the upstream returns no video, or 500 on other
 *   generation errors.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createVideoHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
