import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createUpscaleHandler } from "@/lib/content/upscale/createUpscaleHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/upscale
 *
 * Upscales an image or video to a higher resolution via Fal and returns a URL to
 * the upscaled asset. Body is validated by `validateUpscaleBody` in
 * `lib/content/upscale/`.
 *
 * @param request - The incoming request with JSON body `{ url, type, ... }` where
 *   `type` selects the upscale path (see `validateUpscaleBody` for the full schema).
 * @returns A 200 NextResponse with `{ url }` pointing at the upscaled asset, 400 on
 *   a bad body, 502 when the upstream returns no result, or 500 on other errors.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createUpscaleHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
