import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createLipsyncHandler } from "@/lib/content/lipsync/createLipsyncHandler";

/**
 * CORS preflight for bounded audio-driven generation.
 *
 * @returns An empty CORS response.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Fixed-model audio-driven generation for hosted content.
 *
 * @param request - Authenticated generation request.
 * @returns The generated video URL or a validation/provider error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createLipsyncHandler(request);
}

export const maxDuration = 300;
export const dynamic = "force-dynamic";
