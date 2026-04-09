import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import { createAudioBodySchema } from "@/lib/content/schemas";
import { transcribeAudio } from "./transcribeAudio";

/**
 * POST /api/content/transcribe
 *
 * @param request - Incoming request with audio URLs to transcribe.
 * @returns JSON with transcription and timestamped segments.
 */
export async function createAudioHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const validated = await validatePrimitiveBody(request, createAudioBodySchema);
  if (validated instanceof NextResponse) return validated;

  try {
    const result = await transcribeAudio(validated);
    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("Audio processing error:", error);
    return NextResponse.json(
      { status: "error", error: "Audio processing failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
