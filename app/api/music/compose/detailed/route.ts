import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { composeDetailedHandler } from "@/lib/elevenlabs/composeDetailedHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/compose/detailed
 *
 * Generate a song with metadata and optional word timestamps.
 * Returns multipart/mixed (JSON metadata + binary audio).
 */
export { composeDetailedHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;
