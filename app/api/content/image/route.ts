import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createImageHandler } from "@/lib/content/image/createImageHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/image
 *
 * Generates an image via Fal from a text prompt with optional reference images.
 * Body is validated by `validateCreateImageBody` in `lib/content/image/`.
 *
 * @param request - The incoming request with JSON body `{ prompt, reference_images?,
 *   model?, ... }` (see `validateCreateImageBody` for the full schema).
 * @returns A 200 NextResponse with `{ imageUrl, images: string[] }`, 400 on a bad
 *   body, 502 when Fal returns no image, or 500 on other generation errors.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createImageHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
