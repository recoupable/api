import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { streamHandler } from "@/lib/elevenlabs/streamHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/stream
 *
 * Generate a song and stream audio chunks to the client in real time.
 */
export { streamHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;
