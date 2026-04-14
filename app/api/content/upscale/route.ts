import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createUpscaleHandler } from "@/lib/content/upscale/createUpscaleHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Handles POST requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createUpscaleHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
