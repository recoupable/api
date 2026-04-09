import type { z } from "zod";
import fal from "@/lib/fal/server";
import type { createAudioBodySchema } from "./validateTranscribeAudioBody";

const DEFAULT_MODEL = "fal-ai/whisper";

type AudioParams = z.infer<typeof createAudioBodySchema>;

export interface TranscribeResult {
  audioUrl: string;
  fullLyrics: string;
  segments: Array<{ start: number; end: number; text: string }>;
  segmentCount: number;
}

/**
 * Transcribe audio using the fal whisper model.
 *
 * @param validated - Validated audio transcription parameters.
 * @returns Transcription with lyrics, segments, and segment count.
 */
export async function transcribeAudio(validated: AudioParams): Promise<TranscribeResult> {
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

  return { audioUrl, fullLyrics, segments, segmentCount: segments.length };
}
