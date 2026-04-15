import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createTextHandler } from "@/lib/content/caption/createTextHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/caption
 *
 * Generates on-screen caption text for a social video using a lightweight LLM, with
 * optional template-driven styling (tone, formats, example phrasing). Body is
 * validated by `validateCreateCaptionBody` in `lib/content/caption/`.
 *
 * @param request - The incoming request with JSON body `{ topic, length, template? }`
 *   (see `validateCreateCaptionBody` for the full schema).
 * @returns A 200 NextResponse with `{ content, font, color, borderColor, maxFontSize }`
 *   for the rendered caption, 400 on a bad body, 502 when the LLM returns empty text,
 *   or 500 on other generation errors.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createTextHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
