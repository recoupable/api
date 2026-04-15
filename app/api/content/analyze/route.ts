import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAnalyzeHandler } from "@/lib/content/analyze/createAnalyzeHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/analyze
 *
 * Runs a TwelveLabs analysis over a hosted video to describe scenes, check quality,
 * or evaluate content against a caller-supplied prompt. Body is validated by
 * `validateAnalyzeVideoBody` in `lib/content/analyze/`.
 *
 * @param request - The incoming request with JSON body `{ video_url, prompt, ... }`
 *   (see `validateAnalyzeVideoBody` for the full schema).
 * @returns A 200 NextResponse with `{ text, finish_reason, usage }`, 400 on a bad
 *   body, 500 when TwelveLabs is not configured, or 502 when the upstream analysis
 *   request fails.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAnalyzeHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
