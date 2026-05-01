import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAudioHandler } from "@/lib/content/transcribe/createAudioHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/transcribe
 *
 * Transcribes one or more hosted audio files into text with word-level timestamps.
 * Body is validated by `validateTranscribeAudioBody` in `lib/content/transcribe/`.
 *
 * @param request - The incoming request with JSON body `{ audio_urls, ... }` (see
 *   `validateTranscribeAudioBody` for the full schema).
 * @returns A 200 NextResponse with `{ transcript, segments, language, ... }` per the
 *   transcription result, 400 on a bad body, or 500 when transcription fails.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createAudioHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
