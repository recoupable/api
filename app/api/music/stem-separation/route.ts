import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { stemSeparationHandler } from "@/lib/elevenlabs/stemSeparationHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/music/stem-separation
 *
 * Separate an audio file into individual stems (vocals, drums, bass, etc.).
 * Accepts multipart/form-data with one audio file.
 * Returns a ZIP archive containing the stem files.
 */
export { stemSeparationHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;
