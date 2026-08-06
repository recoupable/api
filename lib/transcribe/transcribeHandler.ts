import { NextRequest, NextResponse } from "next/server";
import { processAudioTranscription } from "@/lib/transcribe/processAudioTranscription";
import { formatTranscriptionError } from "@/lib/transcribe/types";
import { validateTranscribeRequest } from "@/lib/transcribe/validateTranscribeRequest";

/**
 * Handler for POST /api/transcribe.
 *
 * Transcribes a hosted audio file and persists both the audio and the
 * transcript as files against the authenticated account and the artist
 * account.
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the transcription result, or an error.
 */
export async function transcribeHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateTranscribeRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await processAudioTranscription({
      audioUrl: validated.audioUrl,
      ownerAccountId: validated.ownerAccountId,
      artistAccountId: validated.artistAccountId,
      title: validated.title,
      includeTimestamps: validated.includeTimestamps,
    });

    return NextResponse.json({
      success: true,
      audioFile: result.audioFile,
      transcriptFile: result.transcriptFile,
      text: result.text,
      language: result.language,
    });
  } catch (error) {
    const { message, status } = formatTranscriptionError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
