import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createUpscaleHandler } from "@/lib/content/upscale/createUpscaleHandler";

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
  return createUpscaleHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
