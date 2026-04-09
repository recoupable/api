import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "@/lib/content/validatePrimitiveBody";
import fal from "@/lib/fal/server";
import { createAudioBodySchema } from "@/lib/content/schemas";

const DEFAULT_MODEL = "fal-ai/whisper";

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
    const audioUrl = validated.audio_urls[0];

    const result = await fal.subscribe(validated.model ?? DEFAULT_MODEL, {
      input: {
        audio_url: audioUrl,
        task: "transcribe",
        chunk_level: validated.chunk_level,
        language: validated.language,
        diarize: validated.diarize,
      },
    });

    const whisperData = result.data as unknown as {
      text?: string;
      chunks?: Array<{ timestamp: number[]; text: string }>;
    };

    const fullLyrics = whisperData.text ?? "";
    const segments = (whisperData.chunks ?? []).map(chunk => ({
      start: chunk.timestamp[0] ?? 0,
      end: chunk.timestamp[1] ?? 0,
      text: chunk.text?.trim() ?? "",
    }));

    return NextResponse.json(
      {
        audioUrl,
        fullLyrics,
        segments,
        segmentCount: segments.length,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Audio processing error:", error);
    return NextResponse.json(
      { status: "error", error: "Audio processing failed" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
