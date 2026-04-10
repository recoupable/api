import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAudioHandler } from "@/lib/content/transcribe/createAudioHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/transcribe
 *
 * Transcribe audio into text with word-level timestamps.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAudioHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
