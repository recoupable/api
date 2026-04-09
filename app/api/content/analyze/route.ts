import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAnalyzeHandler } from "@/lib/content/primitives/createAnalyzeHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/analyze
 *
 * Analyze a video with AI — describe scenes, check quality, evaluate content.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAnalyzeHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
