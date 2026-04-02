import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePrimitiveBody } from "./validatePrimitiveBody";
import { createAudioBodySchema } from "./schemas";

/**
 * POST /api/content/create/audio
 * Selects and transcribes a song clip using fal.ai Whisper inline.
 *
 * @param request - Incoming request with audio selection parameters.
 * @returns JSON with transcription, clip timing, and lyrics.
 */
export async function createAudioHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePrimitiveBody(request, createAudioBodySchema);
  if (validated instanceof NextResponse) return validated;

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { status: "error", error: "FAL_KEY is not configured" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
  fal.config({ credentials: falKey });

  try {
    const { data } = validated;
    const songUrl = data.songs?.find((s: string) => s.startsWith("http"));

    if (!songUrl) {
      return NextResponse.json(
        { status: "error", error: "A song URL is required (pass a URL in the songs array)" },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const result = await fal.subscribe("fal-ai/whisper" as string, {
      input: {
        audio_url: songUrl,
        task: "transcribe",
        chunk_level: "word",
        language: "en",
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
        songUrl,
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
