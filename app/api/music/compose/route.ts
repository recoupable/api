import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { composeHandler } from "@/lib/elevenlabs/composeHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/compose
 *
 * Generate a song from a text prompt or composition plan using ElevenLabs Music AI.
 * Returns binary audio. The song-id is returned in the response headers.
 */
export { composeHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;
