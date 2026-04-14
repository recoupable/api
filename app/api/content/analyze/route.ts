import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAnalyzeHandler } from "@/lib/content/analyze/createAnalyzeHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAnalyzeHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
