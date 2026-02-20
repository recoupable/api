import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postFlamingoGenerateHandler } from "@/lib/flamingo/postFlamingoGenerateHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/music/analyze
 *
 * Analyze music or answer music questions using the Music Flamingo model.
 * Accepts a text prompt and an optional audio URL. The model can describe
 * tracks, identify genre/tempo/key, transcribe lyrics, and reason about
 * musical structure.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - prompt (required): Text prompt or question about the music
 * - audio_url (optional): Public URL to an audio file (MP3, WAV, FLAC)
 * - max_new_tokens (optional): Max tokens to generate (1–2048, default 512)
 * - temperature (optional): Controls creativity (0–2, default 1.0)
 * - top_p (optional): Nucleus sampling cutoff (0–1, default 1.0)
 * - do_sample (optional): Enable sampling (default false)
 *
 * Response (200):
 * - status: "success"
 * - response: The model's text response
 * - elapsed_seconds: Inference time in seconds
 *
 * @param request - The request object containing the JSON body
 * @returns A NextResponse with the model output or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postFlamingoGenerateHandler(request);
}
