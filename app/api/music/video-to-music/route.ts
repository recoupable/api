import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { videoToMusicHandler } from "@/lib/elevenlabs/videoToMusicHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/video-to-music
 *
 * Generate background music from video files.
 * Accepts multipart/form-data with 1-10 video files (total ≤200MB).
 */
export { videoToMusicHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;
